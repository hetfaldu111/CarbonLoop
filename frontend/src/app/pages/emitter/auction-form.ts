import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { PassportDto } from '../../core/models';
import { TonnesPipe } from '../../shared/pipes';
import { Alert, FieldError, Loading } from '../../shared/widgets';
import { Check, FieldErrors, addDays, errMsg, isBlank, scrollToFirstInvalid, toDateInput, toDateTimeInput, toIso } from '../../shared/utils';

@Component({
  selector: 'app-auction-form',
  imports: [FormsModule, RouterLink, TonnesPipe, Alert, FieldError, Loading],
  template: `
    <div class="nl-wrap">
      <a class="nl-back" routerLink="/emitter/auctions">← Back to Auctions</a>
      <div class="nl-head">
        <h1>New Auction</h1>
        <p>Schedule a live ascending auction for a spot lot. Bidding opens at your starting price and climbs by a fixed increment; whoever holds the last bid when the clock stops buys the lot.</p>
      </div>
      <app-alert [message]="error()" />
      @if (loading()) {<app-loading />}
      @else if (!passports().length) {<div class="alert alert-warn">You have no VERIFIED passports. A lab must issue a Certificate of Analysis before you can auction CO₂.</div>}
      @else {
      <form class="form nl-card" (ngSubmit)="submit()">
        <div class="nl-grid">
          <div class="nl-full">
            <div class="field"><label>CO₂ Passport</label>
              <select name="passportId" [(ngModel)]="f.passportId" (ngModelChange)="onPassport()">@for (p of passports(); track p.id) {<option [value]="p.id">{{ p.passportCode }} — {{ p.source }} · {{ p.concentrationPct }}% · free {{ p.totalVolumeTonnes - p.allocatedTonnes | tonnes }}</option>}</select>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="field" [class.invalid]="fe()['volumeTonnes']">
            <label>Lot size (t) <span class="required-star">*</span></label>
            <input type="number" step="0.1" name="volumeTonnes" [(ngModel)]="f.volumeTonnes" required [attr.aria-invalid]="fe()['volumeTonnes'] ? 'true' : null" />
            <span class="hint">Free on this passport: <strong>{{ free() | tonnes }}</strong></span>
            <app-field-error [msg]="fe()['volumeTonnes']" />
          </div>
          <div class="field" [class.invalid]="fe()['basePricePerTonne']">
            <label>Opening price (₹ / t) <span class="required-star">*</span></label>
            <input type="number" name="basePricePerTonne" [(ngModel)]="f.basePricePerTonne" required [attr.aria-invalid]="fe()['basePricePerTonne'] ? 'true' : null" />
            <app-field-error [msg]="fe()['basePricePerTonne']" />
          </div>
          <div class="field" [class.invalid]="fe()['bidIncrement']">
            <label>Increment per bid (₹ / t) <span class="required-star">*</span></label>
            <input type="number" step="1" name="bidIncrement" [(ngModel)]="f.bidIncrement" required [attr.aria-invalid]="fe()['bidIncrement'] ? 'true' : null" />
            <span class="hint">Every bid raises the price by exactly this much.</span>
            <app-field-error [msg]="fe()['bidIncrement']" />
          </div>
          <div class="field" [class.invalid]="fe()['minPurityPct']">
            <label>Minimum purity you guarantee (%) <span class="required-star">*</span></label>
            <input type="number" step="0.1" name="minPurityPct" [(ngModel)]="f.minPurityPct" required [attr.aria-invalid]="fe()['minPurityPct'] ? 'true' : null" />
            <app-field-error [msg]="fe()['minPurityPct']" />
          </div>
        </div>

        <div class="form-row">
          <div class="field" [class.invalid]="fe()['scheduledStartAt']">
            <label>Bidding opens at <span class="required-star">*</span></label>
            <input type="datetime-local" name="scheduledStartAt" [(ngModel)]="f.scheduledStartAt" required [attr.aria-invalid]="fe()['scheduledStartAt'] ? 'true' : null" />
            <span class="hint">Must be in the future.</span>
            <app-field-error [msg]="fe()['scheduledStartAt']" />
          </div>
          <div class="field" [class.invalid]="fe()['durationMinutes']">
            <label>Stays live for (minutes) <span class="required-star">*</span></label>
            <input type="number" min="1" step="1" name="durationMinutes" [(ngModel)]="f.durationMinutes" required [attr.aria-invalid]="fe()['durationMinutes'] ? 'true' : null" />
            <app-field-error [msg]="fe()['durationMinutes']" />
          </div>
          <div class="field" [class.invalid]="fe()['deliveryWindowStart']">
            <label>Delivery window start <span class="required-star">*</span></label>
            <input type="date" name="deliveryWindowStart" [(ngModel)]="f.deliveryWindowStart" required [attr.aria-invalid]="fe()['deliveryWindowStart'] ? 'true' : null" />
            <app-field-error [msg]="fe()['deliveryWindowStart']" />
          </div>
          <div class="field" [class.invalid]="fe()['deliveryWindowEnd']">
            <label>Delivery window end <span class="required-star">*</span></label>
            <input type="date" name="deliveryWindowEnd" [(ngModel)]="f.deliveryWindowEnd" required [attr.aria-invalid]="fe()['deliveryWindowEnd'] ? 'true' : null" />
            <app-field-error [msg]="fe()['deliveryWindowEnd']" />
          </div>
        </div>

        <div class="alert alert-info">{{ summary() }}</div>

        <div class="field"><label>Description (public)</label><textarea name="description" [(ngModel)]="f.description" rows="3" placeholder="Delivery terms, special requirements… Company identity stays hidden until the auction closes."></textarea></div>

        <div class="nl-foot">
          <button class="em-btn em-btn-green" [disabled]="busy()">{{ busy() ? 'Scheduling…' : 'Schedule Auction' }}</button>
          <a class="em-btn em-btn-out" routerLink="/emitter/auctions">Cancel</a>
          <span class="nl-lock">locks {{ f.volumeTonnes | tonnes }} on the passport</span>
        </div>
      </form>
      }
    </div>`,
})
export class AuctionForm {
  passportId = input<string>();
  private api = inject(ApiService);
  private router = inject(Router);
  passports = signal<PassportDto[]>([]);
  loading = signal(true);
  busy = signal(false);
  error = signal<string | null>(null);
  /** Per-field messages, filled only when a submit is attempted. */
  fe = signal<FieldErrors>({});
  selected = signal<PassportDto | null>(null);
  free = computed(() => { const p = this.selected(); return p ? p.totalVolumeTonnes - p.allocatedTonnes : 0; });
  f = {
    passportId: '', volumeTonnes: 50, basePricePerTonne: 5000, bidIncrement: 100, minPurityPct: 95,
    scheduledStartAt: toDateTimeInput(new Date(Date.now() + 10 * 60000)), durationMinutes: 30,
    deliveryWindowStart: toDateInput(addDays(new Date(), 14)), deliveryWindowEnd: toDateInput(addDays(new Date(), 104)),
    description: '',
  };

  summary(): string {
    const start = new Date(this.f.scheduledStartAt);
    if (isNaN(start.getTime())) return 'Pick a valid opening time.';
    const mins = Number(this.f.durationMinutes) || 0;
    const end = new Date(start.getTime() + mins * 60000);
    const fmt = (d: Date) => d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    return `Bidding opens ${fmt(start)} and closes ${fmt(end)} (${mins} minutes). It starts at ₹${this.f.basePricePerTonne}/t for the whole ${this.f.volumeTonnes} t lot and rises ₹${this.f.bidIncrement}/t per bid. A bid in the final minute extends the clock by a minute. Whoever holds the last bid buys the lot, and that commitment cannot be cancelled.`;
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

  private validate(): Check {
    const c = new Check();
    const f = this.f;
    c.required('passportId', f.passportId, 'A verified passport');
    c.num('volumeTonnes', f.volumeTonnes, 'Lot size', { gt: 0, unit: ' t' });
    c.when(!isBlank(f.volumeTonnes) && Number(f.volumeTonnes) > this.free(), 'volumeTonnes',
      `Only ${this.free()} t is free on this passport. The lot is locked immediately, so it cannot exceed that.`);
    c.num('basePricePerTonne', f.basePricePerTonne, 'Opening price', { gt: 0 });
    c.num('bidIncrement', f.bidIncrement, 'Increment per bid', { gt: 0 });
    c.num('minPurityPct', f.minPurityPct, 'Minimum purity', { gt: 0, max: 100, unit: '%' });
    c.required('scheduledStartAt', f.scheduledStartAt, 'Bidding opens at');
    c.when(Check.inPast(f.scheduledStartAt), 'scheduledStartAt', 'Bidding must open in the future.');
    c.num('durationMinutes', f.durationMinutes, 'Auction duration', { gt: 0, unit: ' minutes' });
    c.required('deliveryWindowStart', f.deliveryWindowStart, 'Delivery window start');
    c.required('deliveryWindowEnd', f.deliveryWindowEnd, 'Delivery window end');
    c.when(Check.notAfter(f.deliveryWindowStart, f.deliveryWindowEnd), 'deliveryWindowEnd', 'The delivery window must end after it starts.');
    return c;
  }

  submit(): void {
    const c = this.validate();
    if (!c.ok) { this.fe.set(c.errors); this.error.set(null); scrollToFirstInvalid(); return; }
    this.fe.set({});

    this.busy.set(true); this.error.set(null);
    this.api.createListing({
      passportId: this.f.passportId, mode: 'AUCTION',
      volumeTonnes: +this.f.volumeTonnes, basePricePerTonne: +this.f.basePricePerTonne, minPurityPct: +this.f.minPurityPct,
      deliveryWindowStart: this.f.deliveryWindowStart, deliveryWindowEnd: this.f.deliveryWindowEnd,
      closesAt: null, description: this.f.description,
      deliveryMonths: null, monthlyTonnes: null,
      bidIncrement: +this.f.bidIncrement,
      scheduledStartAt: toIso(this.f.scheduledStartAt),
      durationMinutes: +this.f.durationMinutes,
    }).subscribe({
      next: (l) => { this.busy.set(false); this.router.navigate(['/emitter/auctions', l.id]); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
}
