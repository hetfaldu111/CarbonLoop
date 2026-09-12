import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ContractOfferInput, DirectoryEntry, ListingDto, NegotiationDto, PassportDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

function base(auth: AuthService): string { return auth.hasRole('EMITTER') ? '/emitter' : '/utilizer'; }

@Component({
  selector: 'app-negotiations-list',
  imports: [DatePipe, RouterLink, StatusBadge, MoneyPipe, TonnesPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="Negotiated contracts" subtitle="Private, bilateral offer / counter-offer threads for multi-month supply. Accepting an offer creates an ACTIVE contract and locks the full committed volume.">
      <a class="btn btn-primary" [routerLink]="base + '/negotiations/new'">Start a negotiation</a>
    </app-page-header>
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!rows().length) {<app-empty-state message="No negotiations yet. Direct-connect with a counterparty to propose a long-term contract." icon="⇄" />}
    @else {
      <div class="card tight table-wrap"><table class="table">
        <thead><tr><th>Passport</th><th>Emitter</th><th>Utilizer</th><th>Latest offer</th><th>Versions</th><th>Status</th><th>Started</th><th></th></tr></thead>
        <tbody>@for (n of rows(); track n.id) {
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
  base = base(inject(AuthService));
  rows = signal<NegotiationDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  constructor() {
    this.api.negotiations().subscribe({ next: (r) => { this.rows.set(r); this.loading.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); } });
  }
  latest(n: NegotiationDto) { return n.offers.length ? n.offers[n.offers.length - 1] : null; }
}

@Component({
  selector: 'app-offer-form',
  imports: [FormsModule],
  template: `
    <div class="form-row">
      <div class="field"><label>Price (₹ / tonne)</label><input type="number" [(ngModel)]="o().pricePerTonne" /></div>
      <div class="field"><label>Volume per month (t)</label><input type="number" step="0.1" [(ngModel)]="o().volumePerMonth" /></div>
      <div class="field"><label>Duration (months)</label><input type="number" [(ngModel)]="o().durationMonths" /></div>
      <div class="field"><label>Pricing structure</label><select [(ngModel)]="o().pricingStructure"><option value="FIXED">Fixed for full duration</option><option value="INDEXED">Indexed to cost formula</option></select></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Deposit / escrow (%)</label><input type="number" step="0.5" [(ngModel)]="o().depositPct" /><span class="hint">Held at signing; forfeited + tier penalty if broken early.</span></div>
      <div class="field"><label>SLA supply-gap threshold (%)</label><input type="number" step="0.5" [(ngModel)]="o().supplyGapThresholdPct" /><span class="hint">Shortfall allowed before penalty. Ties into forecast alerts.</span></div>
      <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" [(ngModel)]="o().takeOrPay" /> Take-or-pay clause</label></div>
    </div>
    <div class="field"><label>Message</label><textarea [(ngModel)]="o().message" placeholder="Context for the counterparty"></textarea></div>
    <p class="muted small">Total commitment: {{ (o().volumePerMonth || 0) * (o().durationMonths || 0) }} t · contract value ₹{{ ((o().volumePerMonth || 0) * (o().durationMonths || 0) * (o().pricePerTonne || 0)).toLocaleString('en-IN') }}</p>`,
})
export class OfferForm {
  o = input.required<ContractOfferInput>();
}

@Component({
  selector: 'app-negotiation-new',
  imports: [FormsModule, RouterLink, OfferForm, Alert, Loading, PageHeader, LabelPipe],
  template: `
    <app-page-header title="Start a negotiation" subtitle="Direct-connect with a counterparty and propose the first version of a long-term contract." />
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else {
      <div class="card">
        <div class="form-row">
          <div class="field"><label>{{ isEmitter ? 'Utilizer' : 'Emitter' }}</label>
            <select [(ngModel)]="counterparty" (ngModelChange)="onCounterparty()"><option value="">Choose…</option>@for (d of directory(); track d.id) {<option [value]="d.id">{{ d.name }} — {{ d.city }}, {{ d.state }} ({{ d.sector | label }}, {{ d.tier | label }})</option>}</select>
          </div>
          <div class="field"><label>CO₂ Passport</label>
            <select [(ngModel)]="passportId">
              <option value="">Choose…</option>
              @if (isEmitter) { @for (p of passports(); track p.id) {<option [value]="p.id">{{ p.passportCode }} — {{ p.source }} ({{ p.concentrationPct }}%, free {{ p.totalVolumeTonnes - p.allocatedTonnes }} t)</option>} }
              @else { @for (l of listings(); track l.passportId) {<option [value]="l.passportId">{{ l.passportCode }} — {{ l.city }}, {{ l.state }} ({{ l.concentrationPct }}%)</option>} }
            </select>
            @if (!isEmitter) {<span class="hint">Passports are discovered through the emitter's listings. Only verified passports can be contracted.</span>}
          </div>
        </div>
        <h3 class="mt">Initial offer (v1)</h3>
        <app-offer-form [o]="offer" />
        <div class="form-actions"><a class="btn" [routerLink]="base + '/negotiations'">Cancel</a><button class="btn btn-primary" (click)="submit()" [disabled]="busy() || !counterparty || !passportId">Send offer</button></div>
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
          <app-offer-form [o]="draft" />
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
    this.busy.set(true); this.error.set(null);
    const d = this.draft;
    this.api.counterOffer(this.id(), { ...d, pricePerTonne: +d.pricePerTonne, volumePerMonth: +d.volumePerMonth, durationMonths: +d.durationMonths, depositPct: +d.depositPct, supplyGapThresholdPct: +d.supplyGapThresholdPct }).subscribe({
      next: (n) => { this.n.set(n); this.busy.set(false); this.counter.set(false); this.ok.set('Counter-offer sent.'); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
}
