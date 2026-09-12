import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AgreementDto, IMPURITIES, PassportDto, VerificationRequestDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, FieldError, Loading, PageHeader } from '../../shared/widgets';
import { Check, FieldErrors, errMsg, scrollToFirstInvalid } from '../../shared/utils';

@Component({
  selector: 'app-lab-request-detail',
  imports: [DatePipe, JsonPipe, FormsModule, RouterLink, StatusBadge, LabelPipe, MoneyPipe, TonnesPipe, Alert, FieldError, Loading, PageHeader],
  template: `
    @if (loading()) {<app-loading />}
    <app-alert [message]="error()" />
    <app-alert [message]="ok()" tone="success" />
    @if (r(); as r) {
      <app-page-header [title]="(r.type | label) + (r.passportCode ? ' · ' + r.passportCode : '')" [subtitle]="'Priority ' + r.priority + ' · submitted ' + (r.submittedAt | date:'medium') + (r.emitterName ? ' · ' + r.emitterName : '')">
        <app-status-badge [value]="r.status" />
        @if (r.status === 'QUEUED') {<button class="btn btn-primary btn-sm" (click)="claim()" [disabled]="busy()">Claim for review</button>}
      </app-page-header>

      <div class="grid grid-2">
        <div class="card">
          <h3>Claimed specification <span class="muted small">(self-reported by emitter — never trusted as-is)</span></h3>
          @if (passport(); as p) {
            <dl class="kv">
              <dt>Source</dt><dd>{{ p.source }} · {{ p.captureTechnology }}</dd>
              <dt>Concentration</dt><dd><strong>{{ p.concentrationPct }}%</strong></dd>
              <dt>State</dt><dd>{{ p.physicalState | label }} · {{ p.pressureBar }} bar · {{ p.temperatureC }} °C</dd>
              <dt>Meter ID</dt><dd class="mono">{{ p.meterId }}</dd>
              <dt>Location</dt><dd>{{ p.locationName }}</dd>
            </dl>
            <table class="table compact mt"><thead><tr><th>Impurity</th><th class="r">Claimed ppm</th></tr></thead><tbody>@for (i of impurities; track i) {<tr><td>{{ i }}</td><td class="r">{{ p.impurities[i] }}</td></tr>}</tbody></table>
          } @else if (r.claimedSpecs) {<pre class="doc">{{ r.claimedSpecs | json }}</pre>}
          @if (agreement(); as a) {
            <h4 class="mt">Sale under review</h4>
            <dl class="kv"><dt>Parties</dt><dd>{{ a.emitterName }} → {{ a.utilizerName }}</dd><dt>Volume</dt><dd>{{ a.volumeTonnes | tonnes }} @ {{ a.pricePerTonne | money }}/t</dd><dt>Mode</dt><dd><app-status-badge [value]="a.mode" /></dd><dt>Agreement</dt><dd><a [routerLink]="['/agreements', a.id]">open</a></dd></dl>
          }
        </div>
        <div class="card">
          @if (r.status === 'IN_REVIEW') {
            <h3>Measured results &amp; decision</h3>
            @if (r.type === 'PASSPORT_COA') {
              <div class="form-row">
                <div class="field" [class.invalid]="fe()['conc']"><label>Measured CO₂ concentration (%) <span class="required-star">*</span></label><input type="number" step="0.01" [(ngModel)]="d.concentrationPct" required [attr.aria-invalid]="fe()['conc'] ? 'true' : null" /><span class="hint">Required to approve.</span><app-field-error [msg]="fe()['conc']" /></div>
                <div class="field" [class.invalid]="fe()['coa']"><label>COA validity (months) <span class="required-star">*</span></label><input type="number" [(ngModel)]="d.coaValidMonths" required [attr.aria-invalid]="fe()['coa'] ? 'true' : null" /><span class="hint">3–6 months; re-testing is queued automatically on expiry.</span><app-field-error [msg]="fe()['coa']" /></div>
              </div>
              <div class="form-row">@for (i of impurities; track i) {<div class="field"><label>{{ i }} measured (ppm)</label><input type="number" step="0.1" [(ngModel)]="d.impurities[i]" /></div>}</div>
              @if (deviation(); as dev) {<div class="alert" [class.alert-warn]="dev.length" [class.alert-success]="!dev.length">@if (dev.length) {Deviations from claim: {{ dev.join(', ') }}} @else {Measurements match the claimed spec.}</div>}
            } @else {
              <p class="muted small">Confirm the awarded sale is consistent with the passport's verified COA and any point-of-loading sampling. Rejecting cancels the agreement and releases the locked volume.</p>
            }
            <div class="field" [class.invalid]="fe()['notes']"><label>Notes</label><textarea [(ngModel)]="d.notes" placeholder="Method, sample IDs, observations" [attr.aria-invalid]="fe()['notes'] ? 'true' : null"></textarea><span class="hint">Required when rejecting, so the emitter knows why.</span><app-field-error [msg]="fe()['notes']" /></div>
            <div class="form-actions">
              <button class="btn btn-danger" (click)="decide(false)" [disabled]="busy()">Reject</button>
              <button class="btn btn-primary" (click)="decide(true)" [disabled]="busy()">Approve{{ r.type === 'PASSPORT_COA' ? ' & issue COA' : ' sale' }}</button>
            </div>
          } @else if (r.status === 'QUEUED') {
            <h3>Not yet claimed</h3><p class="muted">Claim this request to start the review.</p>
          } @else {
            <h3>Decision</h3>
            <dl class="kv"><dt>Outcome</dt><dd><app-status-badge [value]="r.status" /></dd><dt>Decided</dt><dd>{{ r.decidedAt | date:'medium' }}</dd><dt>Notes</dt><dd>{{ r.notes || '—' }}</dd></dl>
            @if (r.measuredSpecs) {<h4 class="mt">Measured</h4><pre class="doc">{{ r.measuredSpecs | json }}</pre>}
          }
        </div>
      </div>
    }`,
})
export class LabRequestDetail {
  id = input.required<string>();
  private api = inject(ApiService);
  private router = inject(Router);
  impurities = IMPURITIES;
  r = signal<VerificationRequestDto | null>(null);
  passport = signal<PassportDto | null>(null);
  agreement = signal<AgreementDto | null>(null);
  loading = signal(true);
  busy = signal(false);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);
  d = { concentrationPct: 0, coaValidMonths: 6, notes: '', impurities: {} as Record<string, number> };
  deviation = computed(() => {
    const p = this.passport(); if (!p) return null;
    const out: string[] = [];
    if (Math.abs(+this.d.concentrationPct - p.concentrationPct) > 0.5) out.push(`concentration ${this.d.concentrationPct}% vs ${p.concentrationPct}%`);
    for (const i of this.impurities) { const c = p.impurities?.[i]; const m = this.d.impurities[i]; if (c != null && m != null && m > c * 1.2) out.push(`${i} ${m} vs ${c} ppm`); }
    return out;
  });

  ngOnInit(): void { this.load(); }
  load(): void {
    this.api.verificationRequest(this.id()).subscribe({
      next: (r) => {
        this.r.set(r); this.loading.set(false);
        if (r.passportId) this.api.passportPublic(r.passportId).subscribe({ next: (p) => { this.passport.set(p as PassportDto); if (!this.d.concentrationPct) { this.d.concentrationPct = p.concentrationPct; this.d.impurities = { ...(p.impurities ?? {}) }; } }, error: () => {} });
        if (r.agreementId) this.api.agreement(r.agreementId).subscribe({ next: (a) => this.agreement.set(a), error: () => {} });
      },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
  claim(): void {
    this.busy.set(true); this.error.set(null);
    this.api.claimVerification(this.id()).subscribe({ next: (r) => { this.r.set(r); this.busy.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); } });
  }
  /** Per-field messages for the decision form. */
  fe = signal<FieldErrors>({});

  decide(approved: boolean): void {
    const c = new Check();
    if (approved) {
      // Only an approval writes measured specs and issues a certificate.
      c.num('conc', this.d.concentrationPct, 'Measured concentration', { gt: 0, max: 100, unit: '%' });
      c.num('coa', this.d.coaValidMonths, 'COA validity', { gt: 0, unit: ' months' });
    } else {
      c.minLength('notes', this.d.notes, 5, 'A note explaining the rejection');
    }
    if (!c.ok) { this.fe.set(c.errors); scrollToFirstInvalid(); return; }
    this.fe.set({});
    if (!approved && !confirm('Reject this request?')) return;
    this.busy.set(true); this.error.set(null);
    this.api.decideVerification(this.id(), { approved, notes: this.d.notes, coaValidMonths: +this.d.coaValidMonths, measuredSpecs: { concentrationPct: +this.d.concentrationPct, impurities: Object.fromEntries(Object.entries(this.d.impurities).map(([k, v]) => [k, +v])) } }).subscribe({
      next: (r) => { this.r.set(r); this.busy.set(false); this.ok.set(approved ? 'Approved.' : 'Rejected.'); setTimeout(() => this.router.navigateByUrl('/lab'), 800); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
}
