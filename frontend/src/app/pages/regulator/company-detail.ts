import { Component, inject, input, signal } from '@angular/core';
import { DatePipe, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { RegulatorCompanyDetail } from '../../core/models';
import { StatusBadge, TierBadge } from '../../shared/badges';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-regulator-company-detail',
  imports: [DatePipe, PercentPipe, RouterLink, StatusBadge, TierBadge, LabelPipe, MoneyPipe, TonnesPipe, Alert, Loading, PageHeader],
  template: `
    @if (loading()) {<app-loading />}
    <app-alert [message]="error()" />
    @if (d(); as d) {
      <app-page-header [title]="d.company.name" [subtitle]="(d.company.role | label) + ' · ' + (d.company.sector | label) + ' · ' + d.company.city + ', ' + d.company.state + ' · Reg# ' + d.company.registrationNumber">
        <app-status-badge [value]="d.company.status" />
        <app-tier-badge [tier]="d.trust.tier" />
      </app-page-header>
      <div class="row mb">
        @for (f of d.complianceFlags; track f) {<span class="flag flag-red">{{ f }}</span>}
        @for (f of d.incentiveFlags; track f) {<span class="flag flag-green">{{ f }}</span>}
        @if (!d.complianceFlags.length && !d.incentiveFlags.length) {<span class="muted small">No flags.</span>}
      </div>
      @if (d.trust) {
        <div class="grid grid-3 mb">
          <div class="stat"><div class="label">Completion</div><div class="value">{{ d.trust.completionRate | percent:'1.0-0' }}</div><div class="sub">{{ d.trust.completedAgreements }} / {{ d.trust.totalAgreements }}</div></div>
          <div class="stat"><div class="label">Cancellations</div><div class="value">{{ d.trust.cancellationsBeforeExpiry }}</div><div class="sub">rate {{ d.trust.cancellationRate | percent:'1.0-1' }}</div></div>
          <div class="stat"><div class="label">Approved</div><div class="value" style="font-size:1.1rem">{{ d.company.approvedAt | date:'mediumDate' }}</div></div>
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
        <h3>Verification history ({{ d.verificationRequests.length }})</h3>
        @if (!d.verificationRequests.length) {<p class="muted">None.</p>} @else {
          <div class="table-wrap"><table class="table compact"><thead><tr><th>Type</th><th>Passport</th><th>Status</th><th>Submitted</th><th>Decided</th><th>Notes</th></tr></thead>
            <tbody>@for (v of d.verificationRequests; track v.id) {<tr><td>{{ v.type | label }}</td><td class="mono">{{ v.passportCode || '—' }}</td><td><app-status-badge [value]="v.status" /></td><td class="small">{{ v.submittedAt | date:'mediumDate' }}</td><td class="small">{{ v.decidedAt | date:'mediumDate' }}</td><td class="small muted">{{ v.notes }}</td></tr>}</tbody></table></div>
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
export class RegulatorCompanyDetailPage {
  id = input.required<string>();
  private api = inject(ApiService);
  d = signal<RegulatorCompanyDetail | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  ngOnInit(): void {
    this.api.regulatorCompany(this.id()).subscribe({ next: (d) => { this.d.set(d); this.loading.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); } });
  }
}
