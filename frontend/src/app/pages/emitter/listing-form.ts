import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ListingMode, PassportDto } from '../../core/models';
import { TonnesPipe } from '../../shared/pipes';
import { Alert, Loading, PageHeader } from '../../shared/widgets';
import { addDays, errMsg, toDateInput, toDateTimeInput, toIso } from '../../shared/utils';

const MODES: { mode: ListingMode; title: string; analogy: string; fit: string; price: string }[] = [
  { mode: 'TENDER', title: 'Tender (RFQ)', analogy: 'Wholesale', fit: 'Buyers with steady, plannable demand who can commit. Larger volume, longer duration.', price: 'Lower, trust-based. You can accept several proposals at once; the system shows the combination that earns the most.' },
  { mode: 'AUCTION', title: 'Auction', analogy: 'Retail / spot', fit: 'Urgent, one-off, smaller lots. Scheduled live bidding; the last bid when the clock stops wins automatically.', price: 'Higher, urgency premium. Opens at your starting price and climbs by a fixed increment per bid.' },
  { mode: 'CONTRACT', title: 'Negotiated contract', analogy: 'Bilateral long-term', fit: 'Multi-month guaranteed supply (CBAM, green-steel timelines). Recurring schedule, take-or-pay, escrow.', price: 'Custom, privately agreed via offer / counter-offer thread.' },
];

@Component({
  selector: 'app-listing-form',
  imports: [FormsModule, RouterLink, TonnesPipe, Alert, Loading, PageHeader],
  template: `
    <app-page-header title="List CO₂ for sale" subtitle="Choose the sale mode per listing. Listed volume is locked on the passport immediately so it cannot be double-sold." />
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!passports().length) {<div class="alert alert-warn">You have no VERIFIED passports. A lab must issue a Certificate of Analysis before you can list.</div>}
    @else {
      <form class="form" (ngSubmit)="submit()">
        <div class="card">
          <h3>1. Passport</h3>
          <div class="field"><label>Verified CO₂ Passport</label>
            <select name="passportId" [(ngModel)]="f.passportId" (ngModelChange)="onPassport()">@for (p of passports(); track p.id) {<option [value]="p.id">{{ p.passportCode }} — {{ p.source }} · {{ p.concentrationPct }}% · free {{ p.totalVolumeTonnes - p.allocatedTonnes | tonnes }}</option>}</select>
          </div>
        </div>
        <div class="card">
          <h3>2. Sale mode</h3>
          <div class="mode-cards">
            @for (m of modes; track m.mode) {
              <div class="mode-card" [class.selected]="f.mode === m.mode" (click)="f.mode = m.mode">
                <h4>{{ m.title }} <span class="muted small">· {{ m.analogy }}</span></h4>
                <p><strong>Fit:</strong> {{ m.fit }}</p>
                <p class="mt" style="margin-top:0.3rem"><strong>Price:</strong> {{ m.price }}</p>
              </div>
            }
          </div>
          @if (f.mode === 'CONTRACT') {<div class="alert alert-info mt">Contract listings advertise availability; the actual deal is done through a private negotiation thread. Utilizers can direct-connect from this listing.</div>}
        </div>
        <div class="card">
          <h3>3. Terms</h3>
          <div class="form-row">
            <div class="field"><label>Volume to list (t)</label><input type="number" step="0.1" name="volumeTonnes" [(ngModel)]="f.volumeTonnes" required /><span class="hint">Free on this passport: <strong>{{ free() | tonnes }}</strong></span></div>
            <div class="field"><label>{{ f.mode === 'AUCTION' ? 'Starting price (₹ / t)' : 'Base price (₹ / t)' }}</label><input type="number" name="basePricePerTonne" [(ngModel)]="f.basePricePerTonne" required /></div>
            @if (f.mode === 'AUCTION') {<div class="field"><label>Increment per bid (₹ / t)</label><input type="number" step="1" name="bidIncrement" [(ngModel)]="f.bidIncrement" required /><span class="hint">Every bid raises the price by exactly this much.</span></div>}
            <div class="field"><label>Minimum purity you guarantee (%)</label><input type="number" step="0.1" name="minPurityPct" [(ngModel)]="f.minPurityPct" required /></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Delivery window start</label><input type="date" name="deliveryWindowStart" [(ngModel)]="f.deliveryWindowStart" required /></div>
            <div class="field"><label>Delivery window end</label><input type="date" name="deliveryWindowEnd" [(ngModel)]="f.deliveryWindowEnd" required /></div>
            @if (f.mode !== 'AUCTION') {<div class="field"><label>Last date to apply</label><input type="datetime-local" name="closesAt" [(ngModel)]="f.closesAt" required /><span class="hint">Proposals cannot be submitted after this.</span></div>}
          </div>

          @if (f.mode === 'TENDER') {
            <div class="form-row">
              <div class="field"><label>Delivery months (optional)</label><input type="number" min="1" step="1" name="deliveryMonths" [(ngModel)]="f.deliveryMonths" (ngModelChange)="syncMonthly()" /><span class="hint">Spread the volume over a recurring schedule.</span></div>
              <div class="field"><label>Tonnes per month</label><input type="number" step="0.1" name="monthlyTonnes" [(ngModel)]="f.monthlyTonnes" /><span class="hint">Defaults to volume divided by months.</span></div>
            </div>
            @if (f.deliveryMonths && f.monthlyTonnes) {
              <div class="alert alert-info">Agreement policy attached to this tender: <strong>{{ f.monthlyTonnes }} t per month for {{ f.deliveryMonths }} months</strong> ({{ scheduleTotal() }} t in total@if (scheduleMismatch()) {, which does not match the {{ f.volumeTonnes }} t you are listing}).</div>
            }
          }

          @if (f.mode === 'AUCTION') {
            <div class="form-row">
              <div class="field"><label>Bidding opens at</label><input type="datetime-local" name="scheduledStartAt" [(ngModel)]="f.scheduledStartAt" required /><span class="hint">Must be in the future.</span></div>
              <div class="field"><label>Stays live for (minutes)</label><input type="number" min="1" step="1" name="durationMinutes" [(ngModel)]="f.durationMinutes" required /></div>
            </div>
            <div class="alert alert-info">{{ auctionSummary() }}</div>
            @if (startInPast()) {<div class="alert alert-warn">The opening time is in the past. Pick a future time.</div>}
          }
          <div class="field"><label>Description (public)</label><textarea name="description" [(ngModel)]="f.description" placeholder="What buyers should know. Company identity stays hidden until a proposal is made."></textarea></div>
        </div>
        <div class="form-actions"><a class="btn" routerLink="/emitter/listings">Cancel</a><button class="btn btn-primary" [disabled]="busy() || !canSubmit()">{{ f.mode === 'AUCTION' ? 'Schedule auction' : 'Publish listing' }} &amp; lock {{ f.volumeTonnes | tonnes }}</button></div>
      </form>
    }`,
})
export class ListingForm {
  passportId = input<string>();
  private api = inject(ApiService);
  private router = inject(Router);
  modes = MODES;
  passports = signal<PassportDto[]>([]);
  loading = signal(true);
  busy = signal(false);
  error = signal<string | null>(null);
  selected = signal<PassportDto | null>(null);
  free = computed(() => { const p = this.selected(); return p ? p.totalVolumeTonnes - p.allocatedTonnes : 0; });
  f = {
    passportId: '', mode: 'TENDER' as ListingMode, volumeTonnes: 100, basePricePerTonne: 4000, minPurityPct: 95,
    deliveryWindowStart: toDateInput(addDays(new Date(), 14)), deliveryWindowEnd: toDateInput(addDays(new Date(), 104)),
    closesAt: toDateTimeInput(addDays(new Date(), 7)), description: '',
    deliveryMonths: null as number | null, monthlyTonnes: null as number | null,
    bidIncrement: 100, scheduledStartAt: toDateTimeInput(new Date(Date.now() + 10 * 60000)), durationMinutes: 30,
  };

  scheduleTotal(): number { return Math.round((this.f.deliveryMonths ?? 0) * (this.f.monthlyTonnes ?? 0) * 10) / 10; }
  scheduleMismatch(): boolean { return Math.abs(this.scheduleTotal() - +this.f.volumeTonnes) > 0.5; }
  syncMonthly(): void {
    const m = Number(this.f.deliveryMonths);
    if (m > 0) this.f.monthlyTonnes = Math.round((+this.f.volumeTonnes / m) * 10) / 10;
  }
  startInPast(): boolean { return this.f.mode === 'AUCTION' && new Date(this.f.scheduledStartAt).getTime() <= Date.now(); }
  auctionSummary(): string {
    const start = new Date(this.f.scheduledStartAt);
    if (isNaN(start.getTime())) return 'Pick a valid opening time.';
    const mins = Number(this.f.durationMinutes) || 0;
    const end = new Date(start.getTime() + mins * 60000);
    const fmt = (d: Date) => d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    return `Bidding opens ${fmt(start)} and closes ${fmt(end)} (${mins} minutes). It starts at ₹${this.f.basePricePerTonne}/t for the whole ${this.f.volumeTonnes} t lot and rises ₹${this.f.bidIncrement}/t per bid. A bid in the final minute extends the clock by a minute. Whoever holds the last bid buys the lot, and that commitment cannot be cancelled.`;
  }
  canSubmit(): boolean {
    if (+this.f.volumeTonnes > this.free() || +this.f.volumeTonnes <= 0) return false;
    if (this.f.mode === 'AUCTION') return +this.f.bidIncrement > 0 && +this.f.durationMinutes > 0 && !this.startInPast();
    return true;
  }

  ngOnInit(): void {
    this.api.passports().subscribe({
      next: (ps) => {
        const v = ps.filter((p) => p.verificationStatus === 'VERIFIED' && p.labCertificateStatus !== 'EXPIRED');
        this.passports.set(v);
        this.f.passportId = (this.passportId() && v.some((p) => p.id === this.passportId()) ? this.passportId() : v[0]?.id) ?? '';
        this.onPassport(); this.loading.set(false);
      },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
  onPassport(): void {
    const p = this.passports().find((x) => x.id === this.f.passportId) ?? null;
    this.selected.set(p);
    if (p) { this.f.minPurityPct = Math.floor(p.concentrationPct * 10) / 10; }
  }
  submit(): void {
    this.busy.set(true); this.error.set(null);
    this.api.createListing({
      passportId: this.f.passportId, mode: this.f.mode, volumeTonnes: +this.f.volumeTonnes, basePricePerTonne: +this.f.basePricePerTonne, minPurityPct: +this.f.minPurityPct,
      deliveryWindowStart: this.f.deliveryWindowStart, deliveryWindowEnd: this.f.deliveryWindowEnd,
      closesAt: this.f.mode === 'AUCTION' ? null : toIso(this.f.closesAt), description: this.f.description,
      deliveryMonths: this.f.mode === 'TENDER' && this.f.deliveryMonths ? +this.f.deliveryMonths : null,
      monthlyTonnes: this.f.mode === 'TENDER' && this.f.monthlyTonnes ? +this.f.monthlyTonnes : null,
      bidIncrement: this.f.mode === 'AUCTION' ? +this.f.bidIncrement : null,
      scheduledStartAt: this.f.mode === 'AUCTION' ? toIso(this.f.scheduledStartAt) : null,
      durationMinutes: this.f.mode === 'AUCTION' ? +this.f.durationMinutes : null,
    }).subscribe({
      next: (l) => { this.busy.set(false); this.router.navigate([this.f.mode === 'AUCTION' ? '/emitter/auctions' : '/emitter/listings', l.id]); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
}
