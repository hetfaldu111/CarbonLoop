import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ListingMode, PassportDto } from '../../core/models';
import { TonnesPipe } from '../../shared/pipes';
import { Alert, Loading, PageHeader } from '../../shared/widgets';
import { addDays, errMsg, toDateInput, toDateTimeInput, toIso } from '../../shared/utils';

const MODES: { mode: ListingMode; title: string; analogy: string; fit: string; price: string }[] = [
  { mode: 'TENDER', title: 'Tender (RFQ)', analogy: 'Wholesale', fit: 'Buyers with steady, plannable demand who can commit. Larger volume, longer duration.', price: 'Lower, trust-based. Buyers ranked by trust-weighted priority score; you pick the winner.' },
  { mode: 'AUCTION', title: 'Auction', analogy: 'Retail / spot', fit: 'Urgent, one-off, smaller lots. Highest bid wins, above your reserve.', price: 'Higher, urgency premium. Price weighted heavily, but you still see trust context before confirming.' },
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
            @if (f.mode === 'AUCTION') {<div class="field"><label>Reserve price (₹ / t)</label><input type="number" name="reservePricePerTonne" [(ngModel)]="f.reservePricePerTonne" /><span class="hint">Bids below this are rejected.</span></div>}
            <div class="field"><label>Minimum purity you guarantee (%)</label><input type="number" step="0.1" name="minPurityPct" [(ngModel)]="f.minPurityPct" required /></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Delivery window start</label><input type="date" name="deliveryWindowStart" [(ngModel)]="f.deliveryWindowStart" required /></div>
            <div class="field"><label>Delivery window end</label><input type="date" name="deliveryWindowEnd" [(ngModel)]="f.deliveryWindowEnd" required /></div>
            <div class="field"><label>Listing closes at</label><input type="datetime-local" name="closesAt" [(ngModel)]="f.closesAt" required /></div>
          </div>
          <div class="field"><label>Description (public)</label><textarea name="description" [(ngModel)]="f.description" placeholder="What buyers should know. Company identity stays hidden until a proposal is made."></textarea></div>
        </div>
        <div class="form-actions"><a class="btn" routerLink="/emitter/listings">Cancel</a><button class="btn btn-primary" [disabled]="busy() || f.volumeTonnes > free()">Publish listing &amp; lock {{ f.volumeTonnes | tonnes }}</button></div>
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
  f = { passportId: '', mode: 'TENDER' as ListingMode, volumeTonnes: 100, basePricePerTonne: 4000, reservePricePerTonne: null as number | null, minPurityPct: 95, deliveryWindowStart: toDateInput(addDays(new Date(), 14)), deliveryWindowEnd: toDateInput(addDays(new Date(), 104)), closesAt: toDateTimeInput(addDays(new Date(), 7)), description: '' };

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
      deliveryWindowStart: this.f.deliveryWindowStart, deliveryWindowEnd: this.f.deliveryWindowEnd, closesAt: toIso(this.f.closesAt), description: this.f.description,
      reservePricePerTonne: this.f.mode === 'AUCTION' && this.f.reservePricePerTonne ? +this.f.reservePricePerTonne : null,
    }).subscribe({
      next: (l) => { this.busy.set(false); this.router.navigate(['/emitter/listings', l.id]); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
}
