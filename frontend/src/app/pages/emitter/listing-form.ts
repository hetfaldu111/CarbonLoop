import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { PassportDto } from '../../core/models';
import { TonnesPipe } from '../../shared/pipes';
import { Alert, FieldError, Loading } from '../../shared/widgets';
import { Check, FieldErrors, addDays, errMsg, isBlank, scrollToFirstInvalid, toDateInput, toDateTimeInput, toIso } from '../../shared/utils';

@Component({
  selector: 'app-listing-form',
  imports: [FormsModule, RouterLink, TonnesPipe, Alert, FieldError, Loading],
  template: `
    <div class="nl-wrap">
      <a class="nl-back" routerLink="/emitter/listings">← Back to Listings</a>
      <div class="nl-head">
        <h1>New Listing</h1>
        <p>Publish a CO₂ volume for sale or tender. Listed volume is locked on the passport immediately, so it cannot be double-sold.</p>
      </div>
      <app-alert [message]="error()" />
      @if (loading()) {<app-loading />}
      @else if (!passports().length) {<div class="alert alert-warn">You have no VERIFIED passports. A lab must issue a Certificate of Analysis before you can list.</div>}
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
            <div class="field" [class.invalid]="fe()['volumeTonnes']"><label>Volume to list (t) <span class="required-star">*</span></label><input type="number" step="0.1" name="volumeTonnes" [(ngModel)]="f.volumeTonnes" required [attr.aria-invalid]="fe()['volumeTonnes'] ? 'true' : null" /><span class="hint">Free on this passport: <strong>{{ free() | tonnes }}</strong></span><app-field-error [msg]="fe()['volumeTonnes']" /></div>
            <div class="field" [class.invalid]="fe()['basePricePerTonne']"><label>Base price (₹ / t) <span class="required-star">*</span></label><input type="number" name="basePricePerTonne" [(ngModel)]="f.basePricePerTonne" required [attr.aria-invalid]="fe()['basePricePerTonne'] ? 'true' : null" /><app-field-error [msg]="fe()['basePricePerTonne']" /></div>
            <div class="field" [class.invalid]="fe()['minPurityPct']"><label>Minimum purity you guarantee (%) <span class="required-star">*</span></label><input type="number" step="0.1" name="minPurityPct" [(ngModel)]="f.minPurityPct" required [attr.aria-invalid]="fe()['minPurityPct'] ? 'true' : null" /><app-field-error [msg]="fe()['minPurityPct']" /></div>
          </div>
          <div class="form-row">
            <div class="field" [class.invalid]="fe()['deliveryWindowStart']"><label>Delivery window start <span class="required-star">*</span></label><input type="date" name="deliveryWindowStart" [(ngModel)]="f.deliveryWindowStart" required [attr.aria-invalid]="fe()['deliveryWindowStart'] ? 'true' : null" /><app-field-error [msg]="fe()['deliveryWindowStart']" /></div>
            <div class="field" [class.invalid]="fe()['deliveryWindowEnd']"><label>Delivery window end <span class="required-star">*</span></label><input type="date" name="deliveryWindowEnd" [(ngModel)]="f.deliveryWindowEnd" required [attr.aria-invalid]="fe()['deliveryWindowEnd'] ? 'true' : null" /><app-field-error [msg]="fe()['deliveryWindowEnd']" /></div>
            <div class="field" [class.invalid]="fe()['closesAt']"><label>Last date to apply <span class="required-star">*</span></label><input type="datetime-local" name="closesAt" [(ngModel)]="f.closesAt" required [attr.aria-invalid]="fe()['closesAt'] ? 'true' : null" /><span class="hint">Proposals cannot be submitted after this.</span><app-field-error [msg]="fe()['closesAt']" /></div>
          </div>

          <div class="form-row">
              <div class="field" [class.invalid]="fe()['deliveryMonths']"><label>Delivery months (optional)</label><input type="number" min="1" step="1" name="deliveryMonths" [(ngModel)]="f.deliveryMonths" (ngModelChange)="syncMonthly()" [attr.aria-invalid]="fe()['deliveryMonths'] ? 'true' : null" /><span class="hint">Spread the volume over a recurring schedule.</span><app-field-error [msg]="fe()['deliveryMonths']" /></div>
              <div class="field" [class.invalid]="fe()['monthlyTonnes']"><label>Tonnes per month</label><input type="number" step="0.1" name="monthlyTonnes" [(ngModel)]="f.monthlyTonnes" [attr.aria-invalid]="fe()['monthlyTonnes'] ? 'true' : null" /><span class="hint">Defaults to volume divided by months.</span><app-field-error [msg]="fe()['monthlyTonnes']" /></div>
            </div>
            @if (f.deliveryMonths && f.monthlyTonnes) {
              <div class="alert alert-info">Agreement policy attached to this tender: <strong>{{ f.monthlyTonnes }} t per month for {{ f.deliveryMonths }} months</strong> ({{ scheduleTotal() }} t in total@if (scheduleMismatch()) {, which does not match the {{ f.volumeTonnes }} t you are listing}).</div>
            }

          <div class="field"><label>Description (public)</label><textarea name="description" [(ngModel)]="f.description" rows="3" placeholder="Delivery terms, special requirements… Company identity stays hidden until a proposal is made."></textarea></div>
        <div class="nl-foot">
          <button class="em-btn em-btn-green" [disabled]="busy()">Publish Listing</button>
          <a class="em-btn em-btn-out" routerLink="/emitter/listings">Cancel</a>
          <span class="nl-lock">locks {{ f.volumeTonnes | tonnes }} on the passport</span>
        </div>
      </form>
      }
    </div>`,
})
export class ListingForm {
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
    passportId: '', volumeTonnes: 100, basePricePerTonne: 4000, minPurityPct: 95,
    deliveryWindowStart: toDateInput(addDays(new Date(), 14)), deliveryWindowEnd: toDateInput(addDays(new Date(), 104)),
    closesAt: toDateTimeInput(addDays(new Date(), 7)), description: '',
    deliveryMonths: null as number | null, monthlyTonnes: null as number | null,
  };

  scheduleTotal(): number { return Math.round((this.f.deliveryMonths ?? 0) * (this.f.monthlyTonnes ?? 0) * 10) / 10; }
  scheduleMismatch(): boolean { return Math.abs(this.scheduleTotal() - +this.f.volumeTonnes) > 0.5; }
  syncMonthly(): void {
    const m = Number(this.f.deliveryMonths);
    if (m > 0) this.f.monthlyTonnes = Math.round((+this.f.volumeTonnes / m) * 10) / 10;
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
    c.num('volumeTonnes', f.volumeTonnes, 'Volume to list', { gt: 0, unit: ' t' });
    c.when(!isBlank(f.volumeTonnes) && Number(f.volumeTonnes) > this.free(), 'volumeTonnes',
      `Only ${this.free()} t is free on this passport. Listed volume is locked immediately, so it cannot exceed that.`);
    c.num('basePricePerTonne', f.basePricePerTonne, 'Base price', { gt: 0 });
    c.num('minPurityPct', f.minPurityPct, 'Minimum purity', { gt: 0, max: 100, unit: '%' });

    c.required('deliveryWindowStart', f.deliveryWindowStart, 'Delivery window start');
    c.required('deliveryWindowEnd', f.deliveryWindowEnd, 'Delivery window end');
    c.when(Check.notAfter(f.deliveryWindowStart, f.deliveryWindowEnd), 'deliveryWindowEnd',
      'The delivery window must end after it starts.');

      c.required('closesAt', f.closesAt, 'Last date to apply');
      c.when(Check.inPast(f.closesAt), 'closesAt', 'The closing date must be in the future, or nobody can apply.');

    {
      if (!isBlank(f.deliveryMonths)) c.num('deliveryMonths', f.deliveryMonths, 'Delivery months', { min: 1 });
      if (!isBlank(f.monthlyTonnes)) c.num('monthlyTonnes', f.monthlyTonnes, 'Tonnes per month', { gt: 0, unit: ' t' });
      c.when(!isBlank(f.deliveryMonths) && isBlank(f.monthlyTonnes), 'monthlyTonnes',
        'Give the tonnes per month, or clear the delivery months.');
    }
    return c;
  }

  submit(): void {
    const c = this.validate();
    if (!c.ok) { this.fe.set(c.errors); this.error.set(null); scrollToFirstInvalid(); return; }
    this.fe.set({});

    this.busy.set(true); this.error.set(null);
    this.api.createListing({
      passportId: this.f.passportId, mode: 'TENDER', volumeTonnes: +this.f.volumeTonnes, basePricePerTonne: +this.f.basePricePerTonne, minPurityPct: +this.f.minPurityPct,
      deliveryWindowStart: this.f.deliveryWindowStart, deliveryWindowEnd: this.f.deliveryWindowEnd,
      closesAt: toIso(this.f.closesAt), description: this.f.description,
      deliveryMonths: this.f.deliveryMonths ? +this.f.deliveryMonths : null,
      monthlyTonnes: this.f.monthlyTonnes ? +this.f.monthlyTonnes : null,
    }).subscribe({
      next: (l) => { this.busy.set(false); this.router.navigate(['/emitter/listings', l.id]); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
}
