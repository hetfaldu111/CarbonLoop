import { Component, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AllocationDto, ForecastDto, PassportDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, AllocationBar, Loading, PageHeader } from '../../shared/widgets';
import { addDays, errMsg, toDateInput } from '../../shared/utils';

@Component({
  selector: 'app-passport-detail',
  imports: [DatePipe, DecimalPipe, JsonPipe, FormsModule, RouterLink, StatusBadge, LabelPipe, TonnesPipe, Alert, AllocationBar, Loading, PageHeader],
  template: `
    @if (loading()) {<app-loading />}
    <app-alert [message]="error()" />
    <app-alert [message]="ok()" tone="success" />
    @if (p(); as p) {
      <app-page-header [title]="p.passportCode" [subtitle]="p.source + ' · ' + p.captureTechnology + ' · ' + p.locationName">
        <app-status-badge [value]="p.verificationStatus" />
        <app-status-badge [value]="'MRV ' + p.mrvStatus" />
        @if (p.verificationStatus === 'VERIFIED') {<a class="btn btn-primary btn-sm" [routerLink]="['/emitter/listings/new']" [queryParams]="{ passportId: p.id }">List CO₂ from this passport</a>}
      </app-page-header>
      @if (p.verificationStatus === 'PENDING') {<div class="banner">Awaiting independent lab Certificate of Analysis. Listing is blocked until verified.</div>}
      @if (p.verificationStatus === 'REJECTED') {<div class="alert alert-error">The lab rejected the claimed specification. Edit the passport and re-submit.</div>}
      @if (p.labCertificateStatus === 'EXPIRED') {<div class="alert alert-warn">COA expired — re-testing has been queued. New listings are blocked until re-verified.</div>}

      @if (alloc(); as al) {
        <div class="card mb">
          <h3>Capacity allocation</h3>
          <app-allocation-bar [a]="al" />
          <div class="grid grid-2 mt">
            <div><h4 class="muted small">Listings on this passport</h4>
              @for (l of al.listings; track l.listingId) {<div class="row between small" style="padding:0.25rem 0"><span><app-status-badge [value]="l.mode" /> <app-status-badge [value]="l.status" /></span><a [routerLink]="['/emitter/listings', l.listingId]">{{ l.volumeTonnes | tonnes }} ›</a></div>} @empty {<p class="muted small">None.</p>}
            </div>
            <div><h4 class="muted small">Agreements locking volume</h4>
              @for (a of al.agreements; track a.agreementId) {<div class="row between small" style="padding:0.25rem 0"><span><app-status-badge [value]="a.mode" /> <app-status-badge [value]="a.status" /></span><a [routerLink]="['/agreements', a.agreementId]">{{ a.volumeTonnes | tonnes }} ›</a></div>} @empty {<p class="muted small">None.</p>}
            </div>
          </div>
        </div>
      }

      <div class="grid grid-3">
        <div class="card">
          <h3>Identity &amp; source</h3>
          <dl class="kv">
            <dt>Producer</dt><dd>{{ p.emitterName || '—' }}</dd>
            <dt>Source</dt><dd>{{ p.source }}</dd>
            <dt>Carbon origin</dt><dd>{{ p.carbonOrigin | label }}</dd>
            <dt>Capture technology</dt><dd>{{ p.captureTechnology }}</dd>
            <dt>Meter ID</dt><dd class="mono">{{ p.meterId }}</dd>
            <dt>Capture timestamp</dt><dd>{{ p.captureTimestamp | date:'medium' }}</dd>
            <dt>Location</dt><dd>{{ p.locationName }}<div class="muted small">{{ p.latitude }}, {{ p.longitude }} · {{ p.pipelineConnected ? 'pipeline-connected' : 'no pipeline' }}</div></dd>
          </dl>
        </div>
        <div class="card">
          <h3>Volume &amp; state</h3>
          <dl class="kv">
            <dt>Available</dt><dd>{{ p.dailyTonnage }} t/day <span class="muted small">(range {{ p.dailyTonnageMin }}–{{ p.dailyTonnageMax }})</span></dd>
            <dt>Total volume</dt><dd>{{ p.totalVolumeTonnes | tonnes }}</dd>
            <dt>Allocated / free</dt><dd>{{ p.allocatedTonnes | tonnes }} / {{ p.totalVolumeTonnes - p.allocatedTonnes | tonnes }}</dd>
            <dt>Window</dt><dd>{{ p.availabilityStart | date:'mediumDate' }} → {{ p.availabilityEnd | date:'mediumDate' }}</dd>
            <dt>CO₂ concentration</dt><dd><strong>{{ p.concentrationPct | number:'1.1-2' }}%</strong></dd>
            <dt>State</dt><dd>{{ p.physicalState | label }}</dd>
            <dt>Pressure / temp</dt><dd>{{ p.pressureBar }} bar · {{ p.temperatureC }} °C</dd>
          </dl>
        </div>
        <div class="card">
          <h3>Impurities &amp; verification</h3>
          <table class="table compact"><thead><tr><th>Impurity</th><th class="r">ppm</th></tr></thead><tbody>@for (e of entries(p.impurities); track e[0]) {<tr><td>{{ e[0] }}</td><td class="r">{{ e[1] }}</td></tr>}</tbody></table>
          <dl class="kv mt">
            <dt>Lab certificate</dt><dd><app-status-badge [value]="p.labCertificateStatus" /> {{ p.issuingLabName || '' }}</dd>
            @if (p.coaIssuedAt) {<dt>COA issued</dt><dd>{{ p.coaIssuedAt | date:'mediumDate' }}</dd>}
            @if (p.coaExpiresAt) {<dt>COA expires</dt><dd>{{ p.coaExpiresAt | date:'mediumDate' }}</dd>}
          </dl>
          @if (p.certifications?.length) {<h4 class="muted small mt">Certifications</h4><ul class="small">@for (c of p.certifications; track c.name) {<li><a [href]="c.url" target="_blank" rel="noopener">{{ c.name || c.url }}</a></li>}</ul>}
          @if (hasExtra(p)) {<details><summary class="small">Extra attributes</summary><pre class="doc" style="max-height:160px">{{ p.extraAttributes | json }}</pre></details>}
        </div>
      </div>

      <div class="card mt">
        <div class="row between"><h3>Output forecasts &amp; planned dips</h3><button class="btn btn-sm" (click)="showForecast.set(!showForecast())">Declare an output dip</button></div>
        <p class="muted small">Declaring an expected dip (e.g. planned maintenance) below {{ p.dailyTonnage }} t/day proactively notifies every utilizer sourcing from this passport, with alternative supply suggestions.</p>
        @if (showForecast()) {
          <div class="form-row">
            <div class="field"><label>Period start</label><input type="date" [(ngModel)]="fc.periodStart" /></div>
            <div class="field"><label>Period end</label><input type="date" [(ngModel)]="fc.periodEnd" /></div>
            <div class="field"><label>Expected output (t/day)</label><input type="number" step="0.1" [(ngModel)]="fc.expectedTonnesPerDay" /></div>
            <div class="field"><label>Reason</label><input [(ngModel)]="fc.reason" placeholder="Planned kiln maintenance" /></div>
          </div>
          <div class="form-actions"><button class="btn btn-primary" (click)="addForecast()" [disabled]="busy()">Publish forecast</button></div>
        }
        @if (forecasts().length) {
          <table class="table compact mt"><thead><tr><th>Period</th><th class="r">Expected t/day</th><th class="r">vs normal</th><th>Reason</th><th>Declared</th></tr></thead>
            <tbody>@for (f of forecasts(); track f.id) {<tr><td>{{ f.periodStart | date:'mediumDate' }} → {{ f.periodEnd | date:'mediumDate' }}</td><td class="r">{{ f.expectedTonnesPerDay }}</td><td class="r" [class.neg]="f.expectedTonnesPerDay < p.dailyTonnage">{{ ((f.expectedTonnesPerDay - p.dailyTonnage) / p.dailyTonnage * 100) | number:'1.0-0' }}%</td><td>{{ f.reason }}</td><td class="small">{{ f.createdAt | date:'mediumDate' }}</td></tr>}</tbody></table>
        } @else {<p class="muted small">No forecasts declared.</p>}
      </div>
    }`,
})
export class PassportDetail {
  id = input.required<string>();
  private api = inject(ApiService);
  p = signal<PassportDto | null>(null);
  alloc = signal<AllocationDto | null>(null);
  forecasts = signal<ForecastDto[]>([]);
  loading = signal(true);
  busy = signal(false);
  showForecast = signal(false);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);
  fc = { periodStart: toDateInput(addDays(new Date(), 30)), periodEnd: toDateInput(addDays(new Date(), 40)), expectedTonnesPerDay: 10, reason: '' };

  ngOnInit(): void {
    forkJoin({ p: this.api.passport(this.id()), a: this.api.allocation(this.id()), f: this.api.forecasts(this.id()) }).subscribe({
      next: ({ p, a, f }) => { this.p.set(p); this.alloc.set(a); this.forecasts.set(f); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
  entries(o: Record<string, number> | null | undefined): [string, number][] { return o ? Object.entries(o) : []; }
  hasExtra(p: PassportDto): boolean { return !!p.extraAttributes && Object.keys(p.extraAttributes).length > 0; }
  addForecast(): void {
    this.busy.set(true); this.error.set(null);
    this.api.createForecast(this.id(), { ...this.fc, expectedTonnesPerDay: +this.fc.expectedTonnesPerDay }).subscribe({
      next: (f) => { this.forecasts.update((fs) => [f, ...fs]); this.busy.set(false); this.showForecast.set(false); this.ok.set('Forecast published. Affected utilizers have been notified with alternatives.'); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
}
