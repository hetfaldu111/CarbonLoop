import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ShipmentDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-shipments-list',
  imports: [DatePipe, DecimalPipe, RouterLink, StatusBadge, TonnesPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="Shipments" subtitle="Each shipment carries seal numbers, meter readings and lab samples at loading and delivery. Mismatches are flagged automatically." />
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!rows().length) {<app-empty-state message="No shipments yet. Request one from an active agreement." icon="⛟" />}
    @else {
      <div class="card tight table-wrap">
        <table class="table">
          <thead><tr><th>Passport</th><th>Emitter → Utilizer</th><th>Mode</th><th class="r">Volume</th><th class="r">Distance</th><th>Carrier</th><th>Seal</th><th>Status</th><th>Flags</th><th>Created</th><th></th></tr></thead>
          <tbody>
            @for (s of rows(); track s.id) {
              <tr>
                <td class="mono">{{ s.passportCode }}</td>
                <td class="small">{{ s.emitterName }} → {{ s.utilizerName }}</td>
                <td><app-status-badge [value]="s.transportMode" /></td>
                <td class="r">{{ s.volumeTonnes | tonnes }}</td>
                <td class="r">{{ s.distanceKm | number:'1.0-0' }} km</td>
                <td class="small">{{ s.ownTransport ? 'Own transport' : (s.transportProviderName || 'Awaiting provider') }}</td>
                <td class="mono small">{{ s.sealNumber || '—' }}</td>
                <td><app-status-badge [value]="s.status" /></td>
                <td>@for (f of s.flags; track f) {<span class="flag flag-red">{{ f }}</span>}</td>
                <td class="small">{{ s.createdAt | date:'mediumDate' }}</td>
                <td><a class="btn btn-sm" [routerLink]="['/shipments', s.id]">Open</a></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }`,
})
export class ShipmentsList {
  private api = inject(ApiService);
  rows = signal<ShipmentDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  constructor() {
    this.api.shipments().subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
