import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ShipmentDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, FieldError, Loading, PageHeader } from '../../shared/widgets';
import { Check, FieldErrors, errMsg, scrollToFirstInvalid } from '../../shared/utils';

@Component({
  selector: 'app-shipment-detail',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, StatusBadge, LabelPipe, MoneyPipe, TonnesPipe, Alert, FieldError, Loading, PageHeader],
  template: `
    @if (loading()) {<app-loading />}
    <app-alert [message]="error()" />
    <app-alert [message]="ok()" tone="success" />
    @if (s(); as s) {
      <app-page-header [title]="'Shipment · ' + s.passportCode" [subtitle]="s.emitterName + ' → ' + s.utilizerName + ' · ' + (s.transportMode | label) + ' · ' + (s.distanceKm | number:'1.0-0') + ' km'">
        <app-status-badge [value]="s.status" />
        <a class="btn btn-sm" [routerLink]="['/agreements', s.agreementId]">Agreement</a>
      </app-page-header>

      @if (s.status === 'FLAGGED') {
        <div class="alert alert-error"><strong>Flagged by reconciliation.</strong> @for (f of s.flags; track f) {<span class="flag flag-red">{{ f }}</span>} Lab, emitter and utilizer have been notified; this shipment is held for dispute review.</div>
      }
      @if (s.flags.includes('NO_PROVIDER_IN_RANGE')) {<div class="alert alert-warn">No transport provider within 100 km of the emitter — all providers were notified instead.</div>}

      <div class="grid grid-2">
        <div class="card">
          <h3>Chain of custody</h3>
          <ul class="timeline">
            <li class="done"><div class="t-title">Requested</div><div class="muted small">{{ s.createdAt | date:'medium' }} · {{ s.volumeTonnes | tonnes }} via {{ s.transportMode | label }}</div></li>
            <li [class.done]="stage() >= 1" [class.current]="stage() === 0"><div class="t-title">Carrier assigned</div><div class="muted small">{{ s.ownTransport ? 'Own transport' : (s.transportProviderName || 'Waiting for a provider to accept') }}@if (s.transportCost) { · quoted {{ s.transportCost | money }}}</div></li>
            <li [class.done]="stage() >= 2" [class.current]="stage() === 1"><div class="t-title">Point-of-loading sampling &amp; seal</div>
              @if (s.loadedAt) {<div class="small">Seal <span class="mono">{{ s.sealNumber }}</span> · {{ s.loadedWeightTonnes | tonnes:2 }} loaded · meter {{ s.loadMeterReading }} · purity {{ s.loadSamplePurityPct }}% · {{ s.loadedAt | date:'medium' }}</div>}
              @else {<div class="muted small">Emitter or carrier records seal number, loaded weight, signed meter reading and sample purity.</div>}
            </li>
            <li [class.done]="stage() >= 3 && s.status !== 'FLAGGED'" [class.flag]="s.status === 'FLAGGED'" [class.current]="stage() === 2"><div class="t-title">Point-of-delivery re-sampling &amp; seal check</div>
              @if (s.deliveredAt) {<div class="small">Seal <span class="mono">{{ s.deliverySealNumber }}</span> · {{ s.deliveredWeightTonnes | tonnes:2 }} delivered · meter {{ s.deliveryMeterReading }} · purity {{ s.deliverySamplePurityPct }}% · {{ s.deliveredAt | date:'medium' }}</div>}
              @else {<div class="muted small">Utilizer or carrier records delivery seal, weight, meter and purity. Reconciliation runs automatically.</div>}
            </li>
            <li [class.done]="s.status === 'DELIVERED'" [class.flag]="s.status === 'FLAGGED'"><div class="t-title">Reconciliation</div>
              @if (s.deliveredAt) {
                <div class="small">Weight gap {{ gapPct() | number:'1.2-2' }}% (tolerance {{ s.leakageTolerancePct }}%) · purity drift {{ drift() | number:'1.2-2' }} pt · seal {{ s.sealNumber === s.deliverySealNumber ? 'match' : 'MISMATCH' }}</div>
                @if (s.flags.length) {<div>@for (f of s.flags; track f) {<span class="flag flag-red">{{ f }}</span>}</div>} @else {<span class="flag flag-green">ALL CHECKS PASSED</span>}
              } @else {<div class="muted small">Pending delivery.</div>}
            </li>
          </ul>
        </div>
        <div class="stack">
          @if (canLoad()) {
            <div class="card">
              <h3>Record loading</h3>
              <div class="form-row">
                <div class="field" [class.invalid]="fe()['l_seal']"><label>Tamper-evident seal number <span class="required-star">*</span></label><input [(ngModel)]="load.sealNumber" placeholder="SEAL-0000" required [attr.aria-invalid]="fe()['l_seal'] ? 'true' : null" /><app-field-error [msg]="fe()['l_seal']" /></div>
                <div class="field" [class.invalid]="fe()['l_weight']"><label>Loaded weight (t) <span class="required-star">*</span></label><input type="number" step="0.01" [(ngModel)]="load.loadedWeightTonnes" required [attr.aria-invalid]="fe()['l_weight'] ? 'true' : null" /><app-field-error [msg]="fe()['l_weight']" /></div>
                <div class="field" [class.invalid]="fe()['l_meter']"><label>Signed meter reading <span class="required-star">*</span></label><input type="number" step="0.01" [(ngModel)]="load.meterReading" required [attr.aria-invalid]="fe()['l_meter'] ? 'true' : null" /><app-field-error [msg]="fe()['l_meter']" /></div>
                <div class="field" [class.invalid]="fe()['l_purity']"><label>Sample purity (%) <span class="required-star">*</span></label><input type="number" step="0.01" [(ngModel)]="load.samplePurityPct" required [attr.aria-invalid]="fe()['l_purity'] ? 'true' : null" /><app-field-error [msg]="fe()['l_purity']" /></div>
              </div>
              <div class="form-actions"><button class="btn btn-primary" (click)="doLoad()" [disabled]="busy()">Confirm loaded &amp; in transit</button></div>
            </div>
          }
          @if (canDeliver()) {
            <div class="card">
              <h3>Record delivery</h3>
              <div class="form-row">
                <div class="field" [class.invalid]="fe()['d_seal']"><label>Seal number observed <span class="required-star">*</span></label><input [(ngModel)]="deliver.sealNumber" placeholder="must match loading seal" required [attr.aria-invalid]="fe()['d_seal'] ? 'true' : null" /><app-field-error [msg]="fe()['d_seal']" /></div>
                <div class="field" [class.invalid]="fe()['d_weight']"><label>Delivered weight (t) <span class="required-star">*</span></label><input type="number" step="0.01" [(ngModel)]="deliver.deliveredWeightTonnes" required [attr.aria-invalid]="fe()['d_weight'] ? 'true' : null" /><app-field-error [msg]="fe()['d_weight']" /></div>
                <div class="field" [class.invalid]="fe()['d_meter']"><label>Signed meter reading <span class="required-star">*</span></label><input type="number" step="0.01" [(ngModel)]="deliver.meterReading" required [attr.aria-invalid]="fe()['d_meter'] ? 'true' : null" /><app-field-error [msg]="fe()['d_meter']" /></div>
                <div class="field" [class.invalid]="fe()['d_purity']"><label>Sample purity (%) <span class="required-star">*</span></label><input type="number" step="0.01" [(ngModel)]="deliver.samplePurityPct" required [attr.aria-invalid]="fe()['d_purity'] ? 'true' : null" /><app-field-error [msg]="fe()['d_purity']" /></div>
              </div>
              <div class="form-actions"><button class="btn btn-primary" (click)="doDeliver()" [disabled]="busy()">Confirm delivery &amp; reconcile</button></div>
            </div>
          }
          <div class="card">
            <h3>Details</h3>
            <dl class="kv">
              <dt>Volume</dt><dd>{{ s.volumeTonnes | tonnes }}</dd>
              <dt>Distance</dt><dd>{{ s.distanceKm | number:'1.0-0' }} km</dd>
              <dt>Leakage tolerance</dt><dd>{{ s.leakageTolerancePct }}%</dd>
              <dt>Carrier</dt><dd>{{ s.ownTransport ? 'Own transport' : (s.transportProviderName || '—') }}</dd>
              <dt>Shipment ID</dt><dd class="mono small">{{ s.id }}</dd>
            </dl>
          </div>
        </div>
      </div>
    }`,
})
export class ShipmentDetail {
  id = input.required<string>();
  private api = inject(ApiService);
  private auth = inject(AuthService);
  s = signal<ShipmentDto | null>(null);
  loading = signal(true);
  busy = signal(false);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);
  /** Per-field messages, filled only when one of the two forms is submitted. */
  fe = signal<FieldErrors>({});
  load = { sealNumber: '', loadedWeightTonnes: 0, meterReading: 0, samplePurityPct: 0 };
  deliver = { sealNumber: '', deliveredWeightTonnes: 0, meterReading: 0, samplePurityPct: 0 };

  stage = computed(() => { const s = this.s(); if (!s) return 0; if (s.deliveredAt) return 3; if (s.loadedAt) return 2; if (s.status === 'ACCEPTED' || s.ownTransport) return 1; return 0; });
  gapPct = computed(() => { const s = this.s(); if (!s?.loadedWeightTonnes || s.deliveredWeightTonnes == null) return 0; return ((s.loadedWeightTonnes - s.deliveredWeightTonnes) / s.loadedWeightTonnes) * 100; });
  drift = computed(() => { const s = this.s(); return Math.abs((s?.loadSamplePurityPct ?? 0) - (s?.deliverySamplePurityPct ?? 0)); });
  private isTransport = computed(() => this.auth.hasRole('TRANSPORT') && this.s()?.transportProviderId === this.auth.user()?.companyId);
  canLoad = computed(() => { const s = this.s(); if (!s || s.loadedAt) return false; const okStatus = s.status === 'ACCEPTED' || (s.status === 'REQUESTED' && s.ownTransport); return okStatus && (this.auth.hasRole('EMITTER') || this.isTransport()); });
  canDeliver = computed(() => { const s = this.s(); if (!s || s.status !== 'IN_TRANSIT') return false; return this.auth.hasRole('UTILIZER') || this.isTransport(); });

  ngOnInit(): void { this.fetch(); }
  fetch(): void {
    this.api.shipment(this.id()).subscribe({
      next: (s) => { this.s.set(s); this.loading.set(false); if (!this.load.loadedWeightTonnes) this.load.loadedWeightTonnes = s.volumeTonnes; if (!this.deliver.deliveredWeightTonnes) this.deliver.deliveredWeightTonnes = s.loadedWeightTonnes ?? s.volumeTonnes; },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
  doLoad(): void {
    const c = new Check();
    c.required('l_seal', this.load.sealNumber, 'The seal number');
    c.num('l_weight', this.load.loadedWeightTonnes, 'Loaded weight', { gt: 0, unit: ' t' });
    c.num('l_meter', this.load.meterReading, 'The meter reading', { min: 0 });
    c.num('l_purity', this.load.samplePurityPct, 'Sample purity', { gt: 0, max: 100, unit: '%' });
    if (!c.ok) { this.fe.set(c.errors); scrollToFirstInvalid(); return; }
    this.fe.set({});
    this.busy.set(true); this.error.set(null);
    this.api.loadShipment(this.id(), { ...this.load, loadedWeightTonnes: +this.load.loadedWeightTonnes, meterReading: +this.load.meterReading, samplePurityPct: +this.load.samplePurityPct }).subscribe({
      next: (s) => { this.s.set(s); this.busy.set(false); this.ok.set('Loading recorded. Shipment is in transit.'); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
  doDeliver(): void {
    const c = new Check();
    c.required('d_seal', this.deliver.sealNumber, 'The seal number');
    c.num('d_weight', this.deliver.deliveredWeightTonnes, 'Delivered weight', { gt: 0, unit: ' t' });
    c.num('d_meter', this.deliver.meterReading, 'The meter reading', { min: 0 });
    c.num('d_purity', this.deliver.samplePurityPct, 'Sample purity', { gt: 0, max: 100, unit: '%' });
    if (!c.ok) { this.fe.set(c.errors); scrollToFirstInvalid(); return; }
    this.fe.set({});
    this.busy.set(true); this.error.set(null);
    this.api.deliverShipment(this.id(), { ...this.deliver, deliveredWeightTonnes: +this.deliver.deliveredWeightTonnes, meterReading: +this.deliver.meterReading, samplePurityPct: +this.deliver.samplePurityPct }).subscribe({
      next: (s) => { this.s.set(s); this.busy.set(false); this.ok.set(s.status === 'FLAGGED' ? 'Delivery recorded but reconciliation FLAGGED this shipment.' : 'Delivery recorded. All reconciliation checks passed.'); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
}
