import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ContractOfferInput, DirectoryEntry, ListingDto, NegotiationDto, PassportDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, FieldError, Loading, PageHeader } from '../../shared/widgets';
import { Check, FieldErrors, errMsg, scrollToFirstInvalid } from '../../shared/utils';

/** The commercial terms are identical whether opening a negotiation or countering inside one. */
function validateOffer(o: ContractOfferInput, c = new Check()): Check {
  c.num('pricePerTonne', o.pricePerTonne, 'Price per tonne', { gt: 0 });
  c.num('volumePerMonth', o.volumePerMonth, 'Volume per month', { gt: 0, unit: ' t' });
  c.num('durationMonths', o.durationMonths, 'Duration', { min: 1, unit: ' months' });
  c.num('depositPct', o.depositPct, 'Deposit', { min: 0, max: 100, unit: '%' });
  c.num('supplyGapThresholdPct', o.supplyGapThresholdPct, 'Supply-gap threshold', { min: 0, max: 100, unit: '%' });
  return c;
}

function base(auth: AuthService): string { return auth.hasRole('EMITTER') ? '/emitter' : '/utilizer'; }

@Component({
  selector: 'app-negotiations-list',
  imports: [DatePipe, FormsModule, RouterLink, StatusBadge, MoneyPipe, TonnesPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <!-- The emitter portal uses the design's card rows; other roles keep the table. -->
    @if (isEmitter) {
      <div class="em-ac-header">
        <h1>Negotiated contracts</h1>
        <div class="em-ac-tools">
          <div class="em-search">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
              <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" />
            </svg>
            <input [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Search negotiations…" aria-label="Search negotiations" />
          </div>
          <a class="em-btn em-btn-green" [routerLink]="base + '/negotiations/new'">+ Start a Negotiation</a>
        </div>
      </div>
      <p class="em-ac-sub">Private, bilateral offer and counter-offer threads for multi-month supply. Accepting an offer creates an active contract and locks the committed volume.</p>
    } @else {
      <app-page-header title="Negotiated contracts" subtitle="Private, bilateral offer / counter-offer threads for multi-month supply. Accepting an offer creates an ACTIVE contract and locks the full committed volume.">
        <a class="btn btn-primary" [routerLink]="base + '/negotiations/new'">Start a negotiation</a>
      </app-page-header>
    }
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!filtered().length) {<app-empty-state message="No negotiations yet. Direct-connect with a counterparty to propose a long-term contract." icon="⇄" />}
    @else if (isEmitter) {
      <div class="em-negt">
        <table>
          <thead><tr>
            <th>Passport</th><th>{{ isEmitter ? 'Utilizer' : 'Emitter' }}</th>
            <th class="r">Price / t</th><th class="r">Qty</th><th class="r">Duration</th>
            <th class="c">Ver.</th><th>Started</th><th></th>
          </tr></thead>
          <tbody>@for (n of filtered(); track n.id) {
            <tr (click)="open(n)">
              <td><span class="pid">{{ n.passportCode }}</span></td>
              <td class="party">{{ counterparty(n) }}</td>
              @if (latest(n); as o) {
                <td class="r price">{{ o.pricePerTonne | money }}/t</td>
                <td class="r m">{{ o.volumePerMonth }} t/mo</td>
                <td class="r m">{{ o.durationMonths }} mo</td>
              } @else {
                <td class="r price">—</td><td class="r m">—</td><td class="r m">—</td>
              }
              <td class="c"><span class="ver">{{ n.offers.length }}</span></td>
              <td class="m">{{ n.createdAt | date:'mediumDate' }}</td>
              <td class="r"><app-status-badge [value]="n.status" /></td>
            </tr>
          }</tbody>
        </table>
      </div>
    } @else {
      <div class="card tight table-wrap"><table class="table">
        <thead><tr><th>Passport</th><th>Emitter</th><th>Utilizer</th><th>Latest offer</th><th>Versions</th><th>Status</th><th>Started</th><th></th></tr></thead>
        <tbody>@for (n of filtered(); track n.id) {
          <tr>
            <td class="mono">{{ n.passportCode }}</td><td>{{ n.emitterName }}</td><td>{{ n.utilizerName }}</td>
            <td class="small">@if (latest(n); as o) {{{ o.volumePerMonth | tonnes }}/mo × {{ o.durationMonths }} mo @ {{ o.pricePerTonne | money }}/t}</td>
            <td>{{ n.offers.length }}</td>
            <td><app-status-badge [value]="n.status" /></td>
            <td class="small">{{ n.createdAt | date:'mediumDate' }}</td>
            <td><a class="btn btn-sm" [routerLink]="[base + '/negotiations', n.id]">Open</a></td>
          </tr>
        }</tbody>
      </table></div>
    }`,
})
export class NegotiationsList {
  private api = inject(ApiService);
  private router = inject(Router);
  private auth = inject(AuthService);
  base = base(this.auth);
  isEmitter = this.auth.hasRole('EMITTER');
  rows = signal<NegotiationDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  search = signal('');

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.rows().filter((n) => !q ||
      [n.passportCode, n.emitterName, n.utilizerName, n.status].some((v) => (v ?? '').toString().toLowerCase().includes(q)));
  });

  /** The other side of the thread; the signed-in company is always one party. */
  counterparty(n: NegotiationDto): string {
    return (this.isEmitter ? n.utilizerName : n.emitterName) || 'Counterparty';
  }
  /** Row click opens the offer thread. */
  open(n: NegotiationDto): void { this.router.navigateByUrl(`${this.base}/negotiations/${n.id}`); }

  /** Status rail down the left of each row, matching the agreements list. */
  railColour(status: string): string {
    switch (status) {
      case 'ACCEPTED': return '#22c55e';
      case 'OPEN': return '#f59e0b';
      case 'REQUESTED': return '#f59e0b';
      case 'REJECTED': return '#b3261e';
      default: return 'rgba(13,35,24,0.2)';
    }
  }

  constructor() {
    this.api.negotiations().subscribe({ next: (r) => { this.rows.set(r); this.loading.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); } });
  }
  latest(n: NegotiationDto) { return n.offers.length ? n.offers[n.offers.length - 1] : null; }
}

@Component({
  selector: 'app-offer-form',
  imports: [FormsModule, FieldError],
  template: `
    <div class="form-row">
      <div class="field" [class.invalid]="fe()['pricePerTonne']"><label>Price (₹ / tonne) <span class="required-star">*</span></label><input type="number" [(ngModel)]="o().pricePerTonne" required [attr.aria-invalid]="fe()['pricePerTonne'] ? 'true' : null" /><app-field-error [msg]="fe()['pricePerTonne']" /></div>
      <div class="field" [class.invalid]="fe()['volumePerMonth']"><label>Volume per month (t) <span class="required-star">*</span></label><input type="number" step="0.1" [(ngModel)]="o().volumePerMonth" required [attr.aria-invalid]="fe()['volumePerMonth'] ? 'true' : null" /><app-field-error [msg]="fe()['volumePerMonth']" /></div>
      <div class="field" [class.invalid]="fe()['durationMonths']"><label>Duration (months) <span class="required-star">*</span></label><input type="number" [(ngModel)]="o().durationMonths" required [attr.aria-invalid]="fe()['durationMonths'] ? 'true' : null" /><app-field-error [msg]="fe()['durationMonths']" /></div>
      <div class="field"><label>Pricing structure</label><select [(ngModel)]="o().pricingStructure"><option value="FIXED">Fixed for full duration</option><option value="INDEXED">Indexed to cost formula</option></select></div>
    </div>
    <div class="form-row">
      <div class="field" [class.invalid]="fe()['depositPct']"><label>Deposit / escrow (%) <span class="required-star">*</span></label><input type="number" step="0.5" [(ngModel)]="o().depositPct" required [attr.aria-invalid]="fe()['depositPct'] ? 'true' : null" /><span class="hint">Held at signing; forfeited + tier penalty if broken early.</span><app-field-error [msg]="fe()['depositPct']" /></div>
      <div class="field" [class.invalid]="fe()['supplyGapThresholdPct']"><label>SLA supply-gap threshold (%) <span class="required-star">*</span></label><input type="number" step="0.5" [(ngModel)]="o().supplyGapThresholdPct" required [attr.aria-invalid]="fe()['supplyGapThresholdPct'] ? 'true' : null" /><span class="hint">Shortfall allowed before penalty. Ties into forecast alerts.</span><app-field-error [msg]="fe()['supplyGapThresholdPct']" /></div>
      <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" [(ngModel)]="o().takeOrPay" /> Take-or-pay clause</label></div>
    </div>
    <div class="field"><label>Message</label><textarea [(ngModel)]="o().message" placeholder="Context for the counterparty"></textarea></div>
    <p class="muted small">Total commitment: {{ (o().volumePerMonth || 0) * (o().durationMonths || 0) }} t · contract value ₹{{ ((o().volumePerMonth || 0) * (o().durationMonths || 0) * (o().pricePerTonne || 0)).toLocaleString('en-IN') }}</p>`,
})
export class OfferForm {
  o = input.required<ContractOfferInput>();
  /** Supplied by whichever page hosts the form, so both share one set of rules. */
  fe = input<FieldErrors>({});
}

@Component({
  selector: 'app-negotiation-new',
  imports: [FormsModule, RouterLink, OfferForm, Alert, FieldError, Loading, PageHeader, LabelPipe],
  template: `
    <app-page-header title="Start a negotiation" subtitle="Direct-connect with a counterparty and propose the first version of a long-term contract." />
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else {
      <div class="card">
        <div class="form-row">
          <div class="field" [class.invalid]="fe()['counterparty']"><label>{{ isEmitter ? 'Utilizer' : 'Emitter' }} <span class="required-star">*</span></label>
            <select [(ngModel)]="counterparty" (ngModelChange)="onCounterparty()" required [attr.aria-invalid]="fe()['counterparty'] ? 'true' : null"><option value="">Choose…</option>@for (d of directory(); track d.id) {<option [value]="d.id">{{ d.name }} — {{ d.city }}, {{ d.state }} ({{ d.sector | label }}, {{ d.tier | label }})</option>}</select>
            <app-field-error [msg]="fe()['counterparty']" />
          </div>
          <div class="field" [class.invalid]="fe()['passportId']"><label>CO₂ Passport <span class="required-star">*</span></label>
            <select [(ngModel)]="passportId" required [attr.aria-invalid]="fe()['passportId'] ? 'true' : null">
              <option value="">Choose…</option>
              @if (isEmitter) { @for (p of passports(); track p.id) {<option [value]="p.id">{{ p.passportCode }} — {{ p.source }} ({{ p.concentrationPct }}%, free {{ p.totalVolumeTonnes - p.allocatedTonnes }} t)</option>} }
              @else { @for (l of listings(); track l.passportId) {<option [value]="l.passportId">{{ l.passportCode }} — {{ l.city }}, {{ l.state }} ({{ l.concentrationPct }}%)</option>} }
            </select>
            @if (!isEmitter) {<span class="hint">Passports are discovered through the emitter's listings. Only verified passports can be contracted.</span>}
            <app-field-error [msg]="fe()['passportId']" />
          </div>
        </div>
        <h3 class="mt">Initial offer (v1)</h3>
        <app-offer-form [o]="offer" [fe]="fe()" />
        <div class="form-actions"><a class="btn" [routerLink]="base + '/negotiations'">Cancel</a><button class="btn btn-primary" (click)="submit()" [disabled]="busy()">Send offer</button></div>
      </div>
    }`,
})
export class NegotiationNew {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  base = base(this.auth);
  isEmitter = this.auth.hasRole('EMITTER');
  directory = signal<DirectoryEntry[]>([]);
  passports = signal<PassportDto[]>([]);
  listings = signal<ListingDto[]>([]);
  loading = signal(true);
  busy = signal(false);
  error = signal<string | null>(null);
  /** Per-field messages, filled only when the request is submitted. */
  fe = signal<FieldErrors>({});
  counterparty = '';
  passportId = '';
  offer: ContractOfferInput = { pricePerTonne: 3600, volumePerMonth: 40, durationMonths: 12, pricingStructure: 'FIXED', takeOrPay: true, supplyGapThresholdPct: 10, depositPct: 10, message: '' };

  constructor() {
    this.api.directory(this.isEmitter ? 'UTILIZER' : 'EMITTER').subscribe({ next: (d) => { this.directory.set(d); this.loading.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); } });
    if (this.isEmitter) this.api.passports().subscribe({ next: (p) => this.passports.set(p.filter((x) => x.verificationStatus === 'VERIFIED')), error: () => {} });
    else this.api.listings({ status: 'OPEN' }).subscribe({ next: (l) => this.listings.set(l), error: () => {} });
  }
  onCounterparty(): void {
    if (!this.isEmitter) {
      // narrow passports to the chosen emitter where the listing exposes emitterId
      const owned = this.listings().filter((l) => !l.emitterId || l.emitterId === this.counterparty);
      if (owned.length && !owned.some((l) => l.passportId === this.passportId)) this.passportId = '';
    }
  }
  submit(): void {
    const c = new Check();
    c.required('counterparty', this.counterparty, 'A counterparty');
    c.required('passportId', this.passportId, 'A passport');
    validateOffer(this.offer, c);
    if (!c.ok) { this.fe.set(c.errors); this.error.set(null); scrollToFirstInvalid(); return; }
    this.fe.set({});

    this.busy.set(true); this.error.set(null);
    this.api.createNegotiation({ counterpartyCompanyId: this.counterparty, passportId: this.passportId, offer: { ...this.offer, pricePerTonne: +this.offer.pricePerTonne, volumePerMonth: +this.offer.volumePerMonth, durationMonths: +this.offer.durationMonths, depositPct: +this.offer.depositPct, supplyGapThresholdPct: +this.offer.supplyGapThresholdPct } }).subscribe({
      next: (n) => { this.busy.set(false); this.router.navigateByUrl(`${this.base}/negotiations/${n.id}`); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
}

@Component({
  selector: 'app-negotiation-detail',
  imports: [DatePipe, RouterLink, StatusBadge, OfferForm, MoneyPipe, TonnesPipe, LabelPipe, Alert, Loading, PageHeader],
  template: `
    @if (loading()) {<app-loading />}
    <app-alert [message]="error()" />
    <app-alert [message]="ok()" tone="success" />
    @if (n(); as n) {
      <app-page-header [title]="'Negotiation · ' + n.passportCode" [subtitle]="n.emitterName + ' ⇄ ' + n.utilizerName">
        <app-status-badge [value]="n.status" />
        @if (n.agreementId) {<a class="btn btn-primary btn-sm" [routerLink]="['/agreements', n.agreementId]">Open contract agreement</a>}
      </app-page-header>
      @if (n.status === 'ACCEPTED') {<div class="banner">Offer v{{ acceptedVersion() }} accepted. A CONTRACT agreement is active and the committed volume is locked on the passport.</div>}
      @if (n.status === 'REJECTED') {<div class="alert alert-error">Negotiation ended — the latest offer was rejected.</div>}

      <div class="card">
        <h3>Offer thread <span class="muted small">({{ n.offers.length }} version{{ n.offers.length === 1 ? '' : 's' }})</span></h3>
        <div class="thread">
          @for (o of n.offers; track o.id) {
            <div class="offer" [class.mine]="o.proposedByCompanyId === myId">
              <div class="offer-head"><span><strong>v{{ o.version }}</strong> · {{ o.proposedByName }}{{ o.proposedByCompanyId === myId ? ' (you)' : '' }}</span><span><app-status-badge [value]="o.status" /> {{ o.createdAt | date:'medium' }}</span></div>
              <div class="terms">
                <div><span>Price</span>{{ o.pricePerTonne | money }}/t</div>
                <div><span>Volume</span>{{ o.volumePerMonth | tonnes }}/month</div>
                <div><span>Duration</span>{{ o.durationMonths }} months</div>
                <div><span>Pricing</span>{{ o.pricingStructure | label }}</div>
                <div><span>Deposit</span>{{ o.depositPct }}%</div>
                <div><span>Gap threshold</span>{{ o.supplyGapThresholdPct }}%</div>
                <div><span>Take-or-pay</span>{{ o.takeOrPay ? 'Yes' : 'No' }}</div>
                <div><span>Total</span>{{ o.volumePerMonth * o.durationMonths | tonnes }} · {{ o.volumePerMonth * o.durationMonths * o.pricePerTonne | money }}</div>
              </div>
              @if (o.message) {<p class="small mt" style="margin-bottom:0">“{{ o.message }}”</p>}
              @if (o.status === 'PENDING' && n.status === 'OPEN' && o.proposedByCompanyId !== myId) {
                <div class="row mt">
                  <button class="btn btn-primary btn-sm" (click)="accept(o.id)" [disabled]="busy()">Accept v{{ o.version }}</button>
                  <button class="btn btn-sm" (click)="counter.set(!counter()); prefill(o)">Counter-offer</button>
                  <button class="btn btn-danger btn-sm" (click)="reject(o.id)" [disabled]="busy()">Reject</button>
                </div>
              }
              @if (o.status === 'PENDING' && n.status === 'OPEN' && o.proposedByCompanyId === myId) {<p class="muted small mt" style="margin:0.5rem 0 0">Waiting for the counterparty to accept, counter or reject.</p>}
            </div>
          }
        </div>
      </div>
      @if (counter() && n.status === 'OPEN') {
        <div class="card mt">
          <h3>Counter-offer (v{{ n.offers.length + 1 }})</h3>
          <app-offer-form [o]="draft" [fe]="fe()" />
          <div class="form-actions"><button class="btn" (click)="counter.set(false)">Discard</button><button class="btn btn-primary" (click)="sendCounter()" [disabled]="busy()">Send counter-offer</button></div>
        </div>
      }
    }`,
})
export class NegotiationDetail {
  id = input.required<string>();
  private api = inject(ApiService);
  private auth = inject(AuthService);
  myId = this.auth.user()?.companyId;
  n = signal<NegotiationDto | null>(null);
  loading = signal(true);
  busy = signal(false);
  counter = signal(false);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);
  draft: ContractOfferInput = { pricePerTonne: 0, volumePerMonth: 0, durationMonths: 12, pricingStructure: 'FIXED', takeOrPay: true, supplyGapThresholdPct: 10, depositPct: 10, message: '' };
  /** Per-field messages for the counter-offer draft. */
  fe = signal<FieldErrors>({});
  acceptedVersion = computed(() => this.n()?.offers.find((o) => o.status === 'ACCEPTED')?.version ?? '');

  ngOnInit(): void { this.load(); }
  load(): void {
    this.api.negotiation(this.id()).subscribe({ next: (n) => { this.n.set(n); this.loading.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); } });
  }
  prefill(o: ContractOfferInput): void { this.draft = { ...o, message: '' }; }
  accept(offerId: string): void {
    if (!confirm('Accept this offer? A binding CONTRACT agreement will be created and the full committed volume locked on the passport.')) return;
    this.busy.set(true); this.error.set(null);
    this.api.acceptOffer(this.id(), offerId).subscribe({ next: (n) => { this.n.set(n); this.busy.set(false); this.ok.set('Offer accepted — contract agreement created.'); }, error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); } });
  }
  reject(offerId: string): void {
    this.busy.set(true); this.error.set(null);
    this.api.rejectOffer(this.id(), offerId).subscribe({ next: (n) => { this.n.set(n); this.busy.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); } });
  }
  sendCounter(): void {
    const c = validateOffer(this.draft);
    if (!c.ok) { this.fe.set(c.errors); this.error.set(null); scrollToFirstInvalid(); return; }
    this.fe.set({});

    this.busy.set(true); this.error.set(null);
    const d = this.draft;
    this.api.counterOffer(this.id(), { ...d, pricePerTonne: +d.pricePerTonne, volumePerMonth: +d.volumePerMonth, durationMonths: +d.durationMonths, depositPct: +d.depositPct, supplyGapThresholdPct: +d.supplyGapThresholdPct }).subscribe({
      next: (n) => { this.n.set(n); this.busy.set(false); this.counter.set(false); this.ok.set('Counter-offer sent.'); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
}
