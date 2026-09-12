import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { PassportDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-passports',
  imports: [DatePipe, DecimalPipe, RouterLink, StatusBadge, LabelPipe, TonnesPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="CO₂ Passports" subtitle="Each passport is one identifiable CO₂ stream or batch. It must be lab-verified before it can be listed.">
      <a class="btn btn-primary" routerLink="/emitter/passports/new">New passport</a>
    </app-page-header>
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!rows().length) {<app-empty-state message="No passports yet." icon="▤" />}
    @else {
      <div class="card tight table-wrap"><table class="table">
        <thead><tr><th>Passport</th><th>Source</th><th>Capture</th><th class="r">Daily</th><th class="r">Total / free</th><th class="r">CO₂ %</th><th>State</th><th>Verification</th><th>COA</th><th>MRV</th><th></th></tr></thead>
        <tbody>@for (p of rows(); track p.id) {
          <tr>
            <td class="mono"><strong>{{ p.passportCode }}</strong><div class="muted small">{{ p.locationName }}</div></td>
            <td>{{ p.source }}<div class="muted small">{{ p.carbonOrigin | label }}</div></td>
            <td>{{ p.captureTechnology }}</td>
            <td class="r">{{ p.dailyTonnage }} t/d<div class="muted small">{{ p.dailyTonnageMin }}–{{ p.dailyTonnageMax }}</div></td>
            <td class="r">{{ p.totalVolumeTonnes | tonnes }}<div class="muted small">free {{ p.totalVolumeTonnes - p.allocatedTonnes | tonnes }}</div></td>
            <td class="r">{{ p.concentrationPct | number:'1.1-1' }}</td>
            <td>{{ p.physicalState | label }}</td>
            <td><app-status-badge [value]="p.verificationStatus" /></td>
            <td><app-status-badge [value]="p.labCertificateStatus" />@if (p.coaExpiresAt) {<div class="muted small">exp {{ p.coaExpiresAt | date:'mediumDate' }}</div>}</td>
            <td><app-status-badge [value]="p.mrvStatus" /></td>
            <td><a class="btn btn-sm" [routerLink]="['/emitter/passports', p.id]">Open</a></td>
          </tr>
        }</tbody>
      </table></div>
    }`,
})
export class Passports {
  private api = inject(ApiService);
  rows = signal<PassportDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  constructor() {
    this.api.passports().subscribe({ next: (r) => { this.rows.set(r); this.loading.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); } });
  }
}
