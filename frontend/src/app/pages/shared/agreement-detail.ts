import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AgreementDto, ShipmentDto, TransportMode } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, CostStackView, FieldError, Loading, PageHeader } from '../../shared/widgets';
import { Check, FieldErrors, errMsg, scrollToFirstInvalid } from '../../shared/utils';

@Component({
  selector: 'app-agreement-detail',
  imports: [DatePipe, FormsModule, RouterLink, StatusBadge, LabelPipe, MoneyPipe, TonnesPipe, Alert, CostStackView, FieldError, Loading, PageHeader],
  template: `
    @if (loading()) {<app-loading />}
    <app-alert [message]="error()" />
    <app-alert [message]="ok()" tone="success" />
    @if (a(); as a) {
      <app-page-header [title]="(a.mode | label) + ' agreement · ' + a.passportCode" [subtitle]="a.emitterName + ' → ' + a.utilizerName">
        <app-status-badge [value]="a.status" />
        <button class="btn btn-sm" (click)="loadDoc()">Contract document</button>
        @if (isParty() && a.status === 'ACTIVE') {
          <button class="btn btn-primary btn-sm" (click)="showShip.set(!showShip())">Request shipment</button>
          <button class="btn btn-sm" (click)="complete()" [disabled]="busy()">Mark completed</button>
          @if (a.mode === 'CONTRACT') {<button class="btn btn-sm" (click)="renew()" [disabled]="busy()">Renew</button>}
        }
        @if (isParty() && (a.status === 'ACTIVE' || a.status === 'PENDING_VERIFICATION')) {
          <button class="btn btn-danger btn-sm" (click)="showCancel.set(!showCancel())">Cancel…</button>
        }
      </app-page-header>

      @if (a.status === 'PENDING_VERIFICATION') {<div class="banner">Awaiting Verification Lab sale approval. Volume is already locked on the passport; it is released if the lab rejects.</div>}
      @if (a.status === 'CANCELLED') {<div class="alert alert-error">Cancelled{{ a.cancelReason ? ': ' + a.cancelReason : '' }}. Cancelling before expiry counts against the cancelling party's trust score.</div>}

      @if (showCancel()) {
        <div class="card mb">
          <h3>Cancel agreement</h3>
          <p class="muted small">Cancelling before the end date adds a cancellation to your trust profile (−15 points each) and, for contracts, forfeits the deposit.</p>
          <div class="row">
            <span class="field inline-field" [class.invalid]="fe()['cancelReason']">
              <input [(ngModel)]="cancelReason" placeholder="Reason" required
                     [attr.aria-invalid]="fe()['cancelReason'] ? 'true' : null" style="max-width:520px" />
              <app-field-error [msg]="fe()['cancelReason']" />
            </span>
            <button class="btn btn-danger" (click)="cancel()" [disabled]="busy()">Confirm cancellation</button>
          </div>
        </div>
      }
      @if (showShip()) {
        <div class="card mb">
          <h3>Request a shipment</h3>
          <p class="muted small">Third-party transport providers within ~100 km of the emitter are notified and can accept or reject. Or use your own transport.</p>
          <div class="form-row">
            <div class="field"><label>Transport mode</label><select [(ngModel)]="ship.transportMode"><option value="TRUCK">Truck (cryogenic)</option><option value="RAIL">Rail</option><option value="PIPELINE">Pipeline</option></select></div>
            <div class="field" [class.invalid]="fe()['shipVolume']"><label>Volume (t) <span class="required-star">*</span></label><input type="number" step="0.1" [(ngModel)]="ship.volumeTonnes" required [attr.aria-invalid]="fe()['shipVolume'] ? 'true' : null" /><span class="hint">Remaining under this agreement: {{ remaining() | tonnes }}</span><app-field-error [msg]="fe()['shipVolume']" /></div>
            <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" [(ngModel)]="ship.ownTransport" /> Use own transport (no marketplace notification)</label></div>
          </div>
          <div class="form-actions"><button class="btn btn-primary" (click)="createShipment()" [disabled]="busy()">Create shipment</button></div>
        </div>
      }

      <div class="grid grid-2">
        <div class="card">
          <h3>Commercial terms</h3>
          <dl class="kv">
            <dt>Mode</dt><dd><app-status-badge [value]="a.mode" /></dd>
            <dt>Volume</dt><dd>{{ a.volumeTonnes | tonnes }}@if (a.volumePerMonth) { ({{ a.volumePerMonth | tonnes }} / month × {{ a.durationMonths }} months)}</dd>
            <dt>Price</dt><dd>{{ a.pricePerTonne | money }} / t @if (a.pricingStructure) {<span class="muted small">({{ a.pricingStructure | label }})</span>}</dd>
            <dt>Total value</dt><dd><strong>{{ a.totalValue | money }}</strong></dd>
            <dt>Window</dt><dd>{{ a.startsAt | date:'mediumDate' }} → {{ a.endsAt | date:'mediumDate' }}</dd>
            @if (a.mode === 'CONTRACT') {
              <dt>Deposit / escrow</dt><dd>{{ a.depositPct }}% held at signing</dd>
              <dt>Take-or-pay</dt><dd>{{ a.takeOrPay ? 'Yes' : 'No' }}</dd>
              <dt>SLA supply-gap threshold</dt><dd>{{ a.supplyGapThresholdPct }}% before penalty</dd>
            }
            <dt>Created</dt><dd>{{ a.createdAt | date:'medium' }}</dd>
          </dl>
        </div>
        <div class="card">
          <h3>Parties &amp; provenance</h3>
          <dl class="kv">
            <dt>Emitter</dt><dd>{{ a.emitterName }}</dd>
            <dt>Utilizer</dt><dd>{{ a.utilizerName }}</dd>
            <dt>CO₂ Passport</dt><dd class="mono">{{ a.passportCode }}</dd>
            @if (a.listingId) {<dt>Listing</dt><dd><a [routerLink]="listingLink(a.listingId)">open listing</a></dd>}
            @if (a.negotiationId) {<dt>Negotiation</dt><dd><a [routerLink]="negLink(a.negotiationId)">offer thread</a></dd>}
            <dt>Agreement ID</dt><dd class="mono small">{{ a.id }}</dd>
          </dl>
        </div>
      </div>

      @if (a.costStack) {
        <div class="card mt"><h3>Cost stack at award time</h3><app-cost-stack [c]="a.costStack" /></div>
      }

      <div class="card mt">
        <h3>Shipments under this agreement</h3>
        @if (!shipments().length) {<p class="muted">None yet.</p>}
        @else {
          <div class="table-wrap"><table class="table compact">
            <thead><tr><th>Mode</th><th class="r">Volume</th><th>Carrier</th><th>Seal</th><th>Status</th><th>Flags</th><th></th></tr></thead>
            <tbody>@for (s of shipments(); track s.id) {
              <tr><td><app-status-badge [value]="s.transportMode" /></td><td class="r">{{ s.volumeTonnes | tonnes }}</td><td class="small">{{ s.ownTransport ? 'Own' : (s.transportProviderName || 'Awaiting provider') }}</td><td class="mono small">{{ s.sealNumber || '—' }}</td><td><app-status-badge [value]="s.status" /></td><td>@for (f of s.flags; track f) {<span class="flag flag-red">{{ f }}</span>}</td><td><a class="btn btn-sm" [routerLink]="['/shipments', s.id]">Open</a></td></tr>
            }</tbody>
          </table></div>
        }
      </div>

      @if (doc(); as d) {
        <div class="card mt">
          <div class="row between"><h3>Draft contract document</h3><div class="row"><button class="btn btn-sm" (click)="openDoc()">Open in new tab</button><button class="btn btn-sm" (click)="copyDoc()">Copy</button></div></div>
          <pre class="doc">{{ d }}</pre>
        </div>
      }
    }`,
})
export class AgreementDetail {
  id = input.required<string>();
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  a = signal<AgreementDto | null>(null);
  shipments = signal<ShipmentDto[]>([]);
  doc = signal<string | null>(null);
  loading = signal(true);
  busy = signal(false);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);
  showCancel = signal(false);
  showShip = signal(false);
  cancelReason = '';
  ship: { transportMode: TransportMode; ownTransport: boolean; volumeTonnes: number } = { transportMode: 'TRUCK', ownTransport: false, volumeTonnes: 0 };
  isParty = computed(() => { const a = this.a(); const c = this.auth.user()?.companyId; return !!a && (a.emitterId === c || a.utilizerId === c); });
  remaining = computed(() => { const a = this.a(); if (!a) return 0; const used = this.shipments().filter((s) => s.status !== 'FLAGGED').reduce((s, x) => s + x.volumeTonnes, 0); return Math.max(0, a.volumeTonnes - used); });

  ngOnInit(): void { this.load(); }
  load(): void {
    this.api.agreement(this.id()).subscribe({
      next: (a) => { this.a.set(a); this.loading.set(false); this.loadShipments(); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
  loadShipments(): void {
    this.api.shipments().subscribe({ next: (all) => { this.shipments.set(all.filter((s) => s.agreementId === this.id())); if (!this.ship.volumeTonnes) this.ship.volumeTonnes = Math.min(this.remaining(), this.a()?.volumePerMonth || this.remaining()); }, error: () => {} });
  }
  listingLink(id: string): string { return this.auth.hasRole('EMITTER') ? `/emitter/listings/${id}` : `/utilizer/listings/${id}`; }
  negLink(id: string): string { return this.auth.hasRole('EMITTER') ? `/emitter/negotiations/${id}` : `/utilizer/negotiations/${id}`; }
  /** Per-field messages for the cancel and shipment forms on this page. */
  fe = signal<FieldErrors>({});

  cancel(): void {
    const c = new Check();
    c.minLength('cancelReason', this.cancelReason, 5, 'A reason');
    if (!c.ok) { this.fe.set(c.errors); scrollToFirstInvalid(); return; }
    this.fe.set({});
    this.busy.set(true); this.error.set(null);
    this.api.cancelAgreement(this.id(), this.cancelReason.trim()).subscribe({
      next: (a) => { this.a.set(a); this.busy.set(false); this.showCancel.set(false); this.ok.set('Agreement cancelled. Locked volume released.'); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
  complete(): void {
    if (!confirm('Mark this agreement as completed? Both parties gain a completed agreement on their trust profile.')) return;
    this.busy.set(true); this.error.set(null);
    this.api.completeAgreement(this.id()).subscribe({
      next: (a) => { this.a.set(a); this.busy.set(false); this.ok.set('Agreement completed.'); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
  renew(): void {
    this.busy.set(true); this.error.set(null);
    this.api.renewAgreement(this.id()).subscribe({
      next: (n) => { this.busy.set(false); this.router.navigateByUrl(this.negLink(n.id)); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
  createShipment(): void {
    const c = new Check();
    c.num('shipVolume', this.ship.volumeTonnes, 'Volume', { gt: 0, unit: ' t' });
    c.when(Number(this.ship.volumeTonnes) > this.remaining(), 'shipVolume',
      `Only ${this.remaining()} t is left to ship under this agreement.`);
    if (!c.ok) { this.fe.set(c.errors); scrollToFirstInvalid(); return; }
    this.fe.set({});
    this.busy.set(true); this.error.set(null);
    this.api.createShipment(this.id(), { ...this.ship, volumeTonnes: Number(this.ship.volumeTonnes) }).subscribe({
      next: (s) => { this.busy.set(false); this.showShip.set(false); this.ok.set(s.ownTransport ? 'Shipment created with own transport.' : 'Shipment created. Nearby transport providers have been notified.'); this.loadShipments(); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
  loadDoc(): void {
    this.api.agreementDocument(this.id()).subscribe({ next: (d) => this.doc.set(d), error: (e) => this.error.set(errMsg(e)) });
  }
  openDoc(): void {
    const d = this.doc(); if (!d) return;
    const url = URL.createObjectURL(new Blob([d], { type: 'text/plain;charset=utf-8' }));
    window.open(url, '_blank');
  }
  copyDoc(): void { const d = this.doc(); if (d) navigator.clipboard?.writeText(d).then(() => this.ok.set('Contract text copied to clipboard.')); }
}
