import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CostEstimateDto, IMPURITIES, ListingDto, PassportPublicDto, ProposalDto, TransportMode } from '../../core/models';
import { StatusBadge, TierBadge } from '../../shared/badges';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, CostStackView, FieldError, Loading, PageHeader } from '../../shared/widgets';
import { Check, FieldErrors, errMsg, scrollToFirstInvalid } from '../../shared/utils';

@Component({
  selector: 'app-utilizer-listing-detail',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, StatusBadge, TierBadge, LabelPipe, MoneyPipe, TonnesPipe, Alert, CostStackView, FieldError, Loading, PageHeader],
  template: `
    @if (loading()) {<app-loading />}
    <app-alert [message]="error()" />
    @if (l(); as l) {
      <app-page-header [title]="(l.mode | label) + ' · ' + (l.volumeTonnes | tonnes) + ' of ' + l.concentrationPct + '% CO₂'" [subtitle]="l.city + ', ' + l.state + ' · ' + (l.physicalState | label) + ' · ' + l.captureTechnology + ' · closes ' + (l.closesAt | date:'medium')">
        <app-status-badge [value]="l.status" />
        <app-tier-badge [tier]="l.emitterTier" />
      </app-page-header>

      <div class="grid grid-3 mb">
        <div class="stat"><div class="label">{{ l.mode === 'AUCTION' ? 'Starting price' : 'Base price' }}</div><div class="value">{{ l.basePricePerTonne | money }}</div><div class="sub">per tonne @if (l.reservePricePerTonne) {· reserve {{ l.reservePricePerTonne | money }}}</div></div>
        <div class="stat"><div class="label">Guaranteed purity</div><div class="value">{{ l.minPurityPct }}%</div><div class="sub">passport measured {{ l.concentrationPct | number:'1.1-2' }}%</div></div>
        <div class="stat"><div class="label">Delivery window</div><div class="value" style="font-size:1.1rem">{{ l.deliveryWindowStart | date:'mediumDate' }} → {{ l.deliveryWindowEnd | date:'mediumDate' }}</div><div class="sub">{{ l.emitterName || 'Emitter identity revealed after you propose' }}</div></div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <h3>Cost estimator <span class="muted small">— every layer shown separately</span></h3>
          <div class="form-row">
            <div class="field" [class.invalid]="fe()['q_qty']"><label>Quantity (t) <span class="required-star">*</span></label><input type="number" step="0.1" [(ngModel)]="q.quantityTonnes" required [attr.aria-invalid]="fe()['q_qty'] ? 'true' : null" /><app-field-error [msg]="fe()['q_qty']" /></div>
            <div class="field" [class.invalid]="fe()['q_purity']"><label>Purity you need (%) <span class="required-star">*</span></label><input type="number" step="0.1" [(ngModel)]="q.requiredPurityPct" required [attr.aria-invalid]="fe()['q_purity'] ? 'true' : null" /><span class="hint">Above {{ l.concentrationPct }}% adds purification cost.</span><app-field-error [msg]="fe()['q_purity']" /></div>
            <div class="field"><label>Transport mode</label><select [(ngModel)]="q.transportMode"><option value="TRUCK">Truck (cryogenic)</option><option value="RAIL">Rail</option><option value="PIPELINE" [disabled]="!l.pipelineConnected">Pipeline{{ l.pipelineConnected ? '' : ' (site not connected)' }}</option></select></div>
          </div>
          <details>
            <summary class="small">Impurity limits (ppm) — optional, adds conditioning steps</summary>
            <div class="form-row">@for (i of impurities; track i) {<div class="field"><label>{{ i }} max</label><input type="number" [(ngModel)]="limits[i]" placeholder="passport: {{ passport()?.impurities?.[i] ?? '?' }}" /></div>}</div>
          </details>
          <div class="form-actions"><button class="btn btn-primary" (click)="estimate()" [disabled]="estimating()">Calculate delivered cost</button></div>
          <app-alert [message]="estError()" />
        </div>
        <div class="card">
          @if (myProposal(); as mp) {
            <h3>Your {{ l.mode === 'AUCTION' ? 'bid' : 'proposal' }} <app-status-badge [value]="mp.status" /></h3>
            <p class="small">{{ mp.quantityTonnes | tonnes }} at {{ mp.offeredPricePerTonne | money }}/t · {{ mp.durationMonths }} months · escrow {{ mp.acceptsEscrow ? 'yes' : 'no' }}</p>
            @if (mp.status === 'SUBMITTED') {<div class="form-actions mt"><button class="btn btn-danger btn-sm" (click)="withdraw(mp)" [disabled]="busy()">Withdraw</button></div>}
          } @else if (l.status !== 'OPEN') {
            <h3>Listing closed</h3><p class="muted">This listing is {{ l.status | label }}.</p>
          } @else if (l.mode === 'CONTRACT') {
            <h3>Negotiated contract</h3>
            <p class="muted">This emitter wants a private, long-term deal. Start an offer / counter-offer thread.</p>
            <a class="btn btn-primary" routerLink="/utilizer/negotiations/new">Direct-connect &amp; propose contract</a>
          } @else {
            <h3>{{ l.mode === 'AUCTION' ? 'Place a bid' : 'Submit a tender proposal' }}</h3>
            <p class="muted small">@if (l.mode === 'TENDER') {Proposals are ranked by published, deterministic rules and the emitter makes the final call.} @else {Highest bid above reserve wins; the emitter still sees your trading history.}</p>
            <div class="form-row">
              <div class="field" [class.invalid]="fe()['p_qty']"><label>Quantity (t) <span class="required-star">*</span></label><input type="number" step="0.1" [(ngModel)]="p.quantityTonnes" required [attr.aria-invalid]="fe()['p_qty'] ? 'true' : null" /><span class="hint">Up to {{ l.volumeTonnes | tonnes }} is on offer.</span><app-field-error [msg]="fe()['p_qty']" /></div>
              <div class="field" [class.invalid]="fe()['p_price']"><label>Your price (₹ / t) <span class="required-star">*</span></label><input type="number" [(ngModel)]="p.offeredPricePerTonne" required [attr.aria-invalid]="fe()['p_price'] ? 'true' : null" /><span class="hint">At or above the base price of {{ l.basePricePerTonne | money }}.</span><app-field-error [msg]="fe()['p_price']" /></div>
              @if (l.mode === 'TENDER') {
                <div class="field" [class.invalid]="fe()['p_purity']"><label>Required purity (%) <span class="required-star">*</span></label><input type="number" step="0.1" [(ngModel)]="p.requiredPurityPct" required [attr.aria-invalid]="fe()['p_purity'] ? 'true' : null" /><app-field-error [msg]="fe()['p_purity']" /></div>
                <div class="field" [class.invalid]="fe()['p_duration']"><label>Duration / commitment (months) <span class="required-star">*</span></label><input type="number" [(ngModel)]="p.durationMonths" required [attr.aria-invalid]="fe()['p_duration'] ? 'true' : null" /><app-field-error [msg]="fe()['p_duration']" /></div>
              }
            </div>
            @if (l.mode === 'TENDER') {
              <div class="field" [class.invalid]="fe()['p_delivery']"><label>Delivery requirement <span class="required-star">*</span></label><input [(ngModel)]="p.deliveryRequirement" placeholder="e.g. weekly truck deliveries, liquefied at 18 bar" required [attr.aria-invalid]="fe()['p_delivery'] ? 'true' : null" /><app-field-error [msg]="fe()['p_delivery']" /></div>
              <div class="field"><label>Other requirements</label><textarea [(ngModel)]="p.otherRequirements" placeholder="Anything else the emitter should know"></textarea></div>
            }
            <label class="check"><input type="checkbox" [(ngModel)]="p.acceptsEscrow" /> I accept an escrow / deposit lock-in (boosts priority)</label>
            <div class="form-actions mt"><button class="btn btn-primary" (click)="submit()" [disabled]="busy()">{{ l.mode === 'AUCTION' ? 'Place bid' : 'Submit proposal' }}</button></div>
          }
        </div>
      </div>

      @if (est(); as e) {<div class="card mt"><app-cost-stack [c]="e" /></div>}

      @if (passport(); as pp) {
        <div class="card mt">
          <h3>CO₂ Passport {{ pp.passportCode }} <app-status-badge [value]="pp.verificationStatus" /> <span class="muted small">— lab-verified specification</span></h3>
          <div class="grid grid-3">
            <dl class="kv"><dt>Source</dt><dd>{{ pp.source }}</dd><dt>Origin</dt><dd>{{ pp.carbonOrigin | label }}</dd><dt>Capture</dt><dd>{{ pp.captureTechnology }}</dd><dt>Daily output</dt><dd>{{ pp.dailyTonnage }} t/d ({{ pp.dailyTonnageMin }}–{{ pp.dailyTonnageMax }})</dd></dl>
            <dl class="kv"><dt>Concentration</dt><dd>{{ pp.concentrationPct }}%</dd><dt>State</dt><dd>{{ pp.physicalState | label }}</dd><dt>Pressure / temp</dt><dd>{{ pp.pressureBar }} bar · {{ pp.temperatureC }} °C</dd><dt>COA</dt><dd><app-status-badge [value]="pp.labCertificateStatus" /> @if (pp.coaExpiresAt) {<span class="small">exp {{ pp.coaExpiresAt | date:'mediumDate' }}</span>}</dd></dl>
            <table class="table compact"><thead><tr><th>Impurity</th><th class="r">ppm</th></tr></thead><tbody>@for (e of entries(pp.impurities); track e[0]) {<tr><td>{{ e[0] }}</td><td class="r">{{ e[1] }}</td></tr>}</tbody></table>
          </div>
        </div>
      }
    }`,
})
export class UtilizerListingDetail {
  id = input.required<string>();
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  impurities = IMPURITIES;
  l = signal<ListingDto | null>(null);
  passport = signal<PassportPublicDto | null>(null);
  proposals = signal<ProposalDto[]>([]);
  est = signal<CostEstimateDto | null>(null);
  loading = signal(true);
  estimating = signal(false);
  busy = signal(false);
  error = signal<string | null>(null);
  estError = signal<string | null>(null);
  myProposal = computed(() => this.proposals().find((p) => p.utilizerId === this.auth.user()?.companyId && p.status !== 'WITHDRAWN') ?? null);
  q: { quantityTonnes: number; requiredPurityPct: number; transportMode: TransportMode } = { quantityTonnes: 0, requiredPurityPct: 0, transportMode: 'TRUCK' };
  limits: Record<string, number | null> = {};
  /** Per-field messages for both the estimator and the proposal form on this page. */
  fe = signal<FieldErrors>({});
  p = { quantityTonnes: 0, requiredPurityPct: 0, durationMonths: 12, deliveryRequirement: '', offeredPricePerTonne: 0, acceptsEscrow: true, otherRequirements: '' };

  ngOnInit(): void {
    forkJoin({ l: this.api.listing(this.id()), ps: this.api.listingProposals(this.id()) }).subscribe({
      next: ({ l, ps }) => {
        // Auctions are bid in the live room, not with a proposal form.
        if (l.mode === 'AUCTION') { this.router.navigate(['/utilizer/auctions', this.id()], { replaceUrl: true }); return; }
        this.l.set(l); this.proposals.set(ps); this.loading.set(false);
        this.q = { quantityTonnes: l.volumeTonnes, requiredPurityPct: l.minPurityPct, transportMode: 'TRUCK' };
        this.p = { ...this.p, quantityTonnes: l.volumeTonnes, requiredPurityPct: l.minPurityPct, offeredPricePerTonne: l.basePricePerTonne, durationMonths: 12 };
        this.api.passportPublic(l.passportId).subscribe({ next: (pp) => this.passport.set(pp), error: () => {} });
      },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
  entries(o: Record<string, number> | null | undefined): [string, number][] { return o ? Object.entries(o) : []; }
  estimate(): void {
    const l = this.l();
    const c = new Check();
    c.num('q_qty', this.q.quantityTonnes, 'Quantity', { gt: 0, unit: ' t' });
    c.when(!!l && Number(this.q.quantityTonnes) > l.volumeTonnes, 'q_qty',
      `Only ${l?.volumeTonnes} t is listed, so a larger quantity cannot be quoted.`);
    c.num('q_purity', this.q.requiredPurityPct, 'Purity', { gt: 0, max: 100, unit: '%' });
    if (!c.ok) { this.fe.set(c.errors); this.estError.set(null); scrollToFirstInvalid(); return; }
    this.fe.set({});

    this.estimating.set(true); this.estError.set(null);
    const impurityLimits: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.limits)) if (v !== null && v !== undefined && !isNaN(+v) && String(v) !== '') impurityLimits[k] = +v;
    this.api.estimate({ listingId: this.id(), quantityTonnes: +this.q.quantityTonnes, requiredPurityPct: +this.q.requiredPurityPct, transportMode: this.q.transportMode, impurityLimits }).subscribe({
      next: (e) => { this.est.set(e); this.estimating.set(false); }, error: (e) => { this.estError.set(errMsg(e)); this.estimating.set(false); },
    });
  }
  submit(): void {
    const l = this.l();
    const c = new Check();
    c.num('p_qty', this.p.quantityTonnes, 'Quantity', { gt: 0, unit: ' t' });
    c.when(!!l && Number(this.p.quantityTonnes) > l.volumeTonnes, 'p_qty',
      `Only ${l?.volumeTonnes} t is on offer. Ask for that or less.`);
    c.num('p_price', this.p.offeredPricePerTonne, 'Your price', { gt: 0 });
    // The server rejects anything under the base price, so say so here rather than round-tripping.
    c.when(!!l && Number(this.p.offeredPricePerTonne) < l.basePricePerTonne, 'p_price',
      `Your price must be at least the base price of ₹${l?.basePricePerTonne}/t.`);
    c.num('p_purity', this.p.requiredPurityPct, 'Required purity', { gt: 0, max: 100, unit: '%' });
    c.num('p_duration', this.p.durationMonths, 'Duration', { min: 1, unit: ' months' });
    c.required('p_delivery', this.p.deliveryRequirement, 'A delivery requirement');
    if (!c.ok) { this.fe.set(c.errors); this.error.set(null); scrollToFirstInvalid(); return; }
    this.fe.set({});

    this.busy.set(true); this.error.set(null);
    const body = { ...this.p, quantityTonnes: +this.p.quantityTonnes, requiredPurityPct: +this.p.requiredPurityPct, durationMonths: +this.p.durationMonths, offeredPricePerTonne: +this.p.offeredPricePerTonne };
    this.api.submitProposal(this.id(), body).subscribe({
      next: (pr) => { this.proposals.update((ps) => [...ps, pr]); this.busy.set(false); this.api.listing(this.id()).subscribe({ next: (l) => this.l.set(l), error: () => {} }); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
  withdraw(mp: ProposalDto): void {
    this.busy.set(true); this.error.set(null);
    this.api.withdrawProposal(mp.id).subscribe({ next: (pr) => { this.proposals.update((ps) => ps.map((x) => (x.id === pr.id ? pr : x))); this.busy.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); } });
  }
}
