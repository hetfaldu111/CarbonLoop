import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { RegulatorCompanyDetail } from '../../core/models';
import { StatusBadge, TierBadge } from '../../shared/badges';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-admin-company-detail',
  imports: [DatePipe, PercentPipe, RouterLink, StatusBadge, TierBadge, LabelPipe, MoneyPipe, TonnesPipe, Alert, Loading, PageHeader],
  template: `
    @if (loading()) {<app-loading />}
    <app-alert [message]="error()" />
    @if (d(); as d) {
      <app-page-header [title]="d.company.name" [subtitle]="(d.company.role | label) + ' · ' + (d.company.sector | label) + ' · ' + d.company.city + ', ' + d.company.state">
        <app-status-badge [value]="d.company.status" />
        <app-tier-badge [tier]="d.trust.tier" />
        <a class="btn btn-sm" routerLink="/admin/companies">Back to all companies</a>
      </app-page-header>

      <div class="grid grid-2 mb">
        <div class="card">
          <h3>Company</h3>
          <div class="summary-grid">
            <div><span class="muted small">Registration number</span><div>{{ d.company.registrationNumber || '—' }}</div></div>
            <div><span class="muted small">Role</span><div>{{ d.company.role | label }}</div></div>
            <div><span class="muted small">Sector</span><div>{{ d.company.sector | label }}</div></div>
            <div><span class="muted small">Status</span><div><app-status-badge [value]="d.company.status" /></div></div>
            <div><span class="muted small">Registered</span><div>{{ d.company.createdAt | date:'medium' }}</div></div>
            <div><span class="muted small">Approved</span><div>{{ d.company.approvedAt ? (d.company.approvedAt | date:'medium') : '—' }}</div></div>
          </div>
          @if (d.company.rejectionReason) {
            <div class="alert alert-danger mt"><strong>Rejected:</strong> {{ d.company.rejectionReason }}</div>
          }
        </div>
        <div class="card">
          <h3>Contact &amp; location</h3>
          <div class="summary-grid">
            <div><span class="muted small">Email</span><div>{{ d.company.contactEmail }}</div></div>
            <div><span class="muted small">Phone</span><div>{{ d.company.contactPhone }}</div></div>
            <div><span class="muted small">Address</span><div>{{ d.company.address }}</div></div>
            <div><span class="muted small">City / State</span><div>{{ d.company.city }}, {{ d.company.state }}</div></div>
            <div><span class="muted small">Country</span><div>{{ d.company.country }}</div></div>
            <div><span class="muted small">Coordinates</span><div class="mono">{{ d.company.latitude }}, {{ d.company.longitude }}</div></div>
          </div>
        </div>
      </div>

      @if (profileRows().length) {
        <div class="card mb">
          <h3>{{ d.company.role | label }} details</h3>
          <div class="summary-grid">
            @for (r of profileRows(); track r.key) {
              <div><span class="muted small">{{ r.key | label }}</span><div>{{ r.value }}</div></div>
            }
          </div>
        </div>
      }

      <div class="row mb">
        @for (f of d.complianceFlags; track f) {<span class="flag flag-red">{{ f }}</span>}
        @for (f of d.incentiveFlags; track f) {<span class="flag flag-green">{{ f }}</span>}
        @if (!d.complianceFlags.length && !d.incentiveFlags.length) {<span class="muted small">No compliance or incentive flags.</span>}
      </div>

      @if (d.trust) {
        <div class="grid grid-3 mb">
          <div class="stat"><div class="label">Badge</div><div class="value" style="font-size:1.2rem"><app-tier-badge [tier]="d.trust.tier" [basis]="d.trust.badgeBasis" /></div><div class="sub">{{ d.trust.badgeBasis || 'completed agreements' }}</div></div>
          <div class="stat"><div class="label">Completion</div><div class="value">{{ d.trust.completionRate | percent:'1.0-0' }}</div><div class="sub">{{ d.trust.completedAgreements }} / {{ d.trust.totalAgreements }} agreements</div></div>
          <div class="stat"><div class="label">Cancellations</div><div class="value" [class.neg]="d.trust.cancellationsBeforeExpiry > 0">{{ d.trust.cancellationsBeforeExpiry }}</div><div class="sub">before expiry</div></div>
        </div>
      }

      <div class="card">
        <h3>CO₂ Passports ({{ d.passports.length }})</h3>
        @if (!d.passports.length) {<p class="muted">None.</p>} @else {
          <div class="table-wrap"><table class="table compact"><thead><tr><th>Passport</th><th>Source</th><th class="r">Total</th><th class="r">Allocated</th><th class="r">CO₂ %</th><th>Verification</th><th>COA</th><th>MRV</th></tr></thead>
            <tbody>@for (p of d.passports; track p.id) {<tr><td class="mono">{{ p.passportCode }}</td><td>{{ p.source }}</td><td class="r">{{ p.totalVolumeTonnes | tonnes }}</td><td class="r">{{ p.allocatedTonnes | tonnes }}</td><td class="r">{{ p.concentrationPct }}</td><td><app-status-badge [value]="p.verificationStatus" /></td><td><app-status-badge [value]="p.labCertificateStatus" /> @if (p.coaExpiresAt) {<span class="small muted">exp {{ p.coaExpiresAt | date:'mediumDate' }}</span>}</td><td><app-status-badge [value]="p.mrvStatus" /></td></tr>}</tbody></table></div>
        }
      </div>

      <div class="card mt">
        <h3>Agreements ({{ d.agreements.length }})</h3>
        @if (!d.agreements.length) {<p class="muted">None.</p>} @else {
          <div class="table-wrap"><table class="table compact"><thead><tr><th>Mode</th><th>Emitter</th><th>Utilizer</th><th class="r">Volume</th><th class="r">Price / t</th><th>Window</th><th>Status</th><th></th></tr></thead>
            <tbody>@for (a of d.agreements; track a.id) {<tr><td><app-status-badge [value]="a.mode" /></td><td>{{ a.emitterName }}</td><td>{{ a.utilizerName }}</td><td class="r">{{ a.volumeTonnes | tonnes }}</td><td class="r">{{ a.pricePerTonne | money }}</td><td class="small">{{ a.startsAt | date:'mediumDate' }} → {{ a.endsAt | date:'mediumDate' }}</td><td><app-status-badge [value]="a.status" /></td><td><a class="btn btn-sm" [routerLink]="['/agreements', a.id]">Open</a></td></tr>}</tbody></table></div>
        }
      </div>

      <div class="card mt">
        <h3>Shipments ({{ d.shipments.length }})</h3>
        @if (!d.shipments.length) {<p class="muted">None.</p>} @else {
          <div class="table-wrap"><table class="table compact"><thead><tr><th>Passport</th><th>Mode</th><th class="r">Volume</th><th>Seal</th><th>Status</th><th>Flags</th><th></th></tr></thead>
            <tbody>@for (s of d.shipments; track s.id) {<tr><td class="mono">{{ s.passportCode }}</td><td>{{ s.transportMode | label }}</td><td class="r">{{ s.volumeTonnes | tonnes }}</td><td class="mono small">{{ s.sealNumber || '—' }}</td><td><app-status-badge [value]="s.status" /></td><td>@for (f of s.flags; track f) {<span class="flag flag-red">{{ f }}</span>}</td><td><a class="btn btn-sm" [routerLink]="['/shipments', s.id]">Open</a></td></tr>}</tbody></table></div>
        }
      </div>
    }`,
})
export class AdminCompanyDetail {
  id = input.required<string>();
  private api = inject(ApiService);
  d = signal<RegulatorCompanyDetail | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  /** The role-specific sign-up answers, rendered as plain key/value rows. */
  profileRows = computed(() => {
    const p = this.d()?.company?.roleProfile;
    if (!p) return [];
    return Object.entries(p)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([key, v]) => ({ key, value: typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v) }));
  });

  ngOnInit(): void {
    this.api.regulatorCompany(this.id()).subscribe({
      next: (d) => { this.d.set(d); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
