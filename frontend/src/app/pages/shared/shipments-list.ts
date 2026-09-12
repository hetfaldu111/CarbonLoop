import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ShipmentDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-shipments-list',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, StatusBadge, LabelPipe, TonnesPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <!-- The emitter portal uses the design's cards; other roles keep the table. -->
    @if (isEmitter) {
      <div class="em-ac-header">
        <h1>Shipments</h1>
        <div class="em-ac-tools">
          <div class="em-search">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
              <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" />
            </svg>
            <input [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Search shipments…" aria-label="Search shipments" />
          </div>
        </div>
      </div>
      <p class="em-ac-sub">Each shipment carries seal numbers, meter readings and lab samples at loading and delivery. Mismatches are flagged automatically.</p>
    } @else {
      <app-page-header title="Shipments" subtitle="Each shipment carries seal numbers, meter readings and lab samples at loading and delivery. Mismatches are flagged automatically." />
    }

    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!filtered().length) {<app-empty-state message="No shipments yet. Request one from an active agreement." icon="⛟" />}
    @else if (isEmitter) {
      <div class="em-ship-grid">
        @for (s of filtered(); track s.id) {
          <a class="em-ship" [class.bad]="isFlagged(s)" [routerLink]="['/shipments', s.id]">
            <span class="stripe" [style.background]="stageColour(s)"></span>
            <span class="body">
              <span class="head">
                <span class="who">
                  <span class="nm">{{ s.utilizerName || 'Delivery' }}</span>
                  <span class="id">{{ s.passportCode }} · {{ s.sealNumber || 'no seal yet' }}</span>
                </span>
                <app-status-badge [value]="s.status" />
              </span>

              <span class="stats">
                <span><span class="l">Volume</span><span class="v">{{ s.volumeTonnes | tonnes }}</span></span>
                <span><span class="l">Mode</span><span class="v">{{ s.transportMode | label }}</span></span>
                <span><span class="l">Distance</span><span class="v">{{ s.distanceKm | number:'1.0-0' }} km</span></span>
              </span>

              <span class="carrier">{{ s.ownTransport ? 'Own transport' : (s.transportProviderName || 'Awaiting a carrier') }}</span>

              <span class="prog">
                <span class="prog-top">
                  <span class="l">Chain of custody</span>
                  <span class="pc" [style.color]="stageColour(s)">{{ stageLabel(s) }}</span>
                </span>
                <span class="bar"><span class="fill" [style.width.%]="stagePct(s)" [style.background]="stageColour(s)"></span></span>
              </span>

              @if (s.flags.length) {
                <span class="flags">@for (f of s.flags; track f) {<span class="flag flag-red">{{ f | label }}</span>}</span>
              }
            </span>
          </a>
        }
      </div>
    } @else {
      <div class="card tight table-wrap">
        <table class="table">
          <thead><tr><th>Passport</th><th>Emitter → Utilizer</th><th>Mode</th><th class="r">Volume</th><th class="r">Distance</th><th>Carrier</th><th>Seal</th><th>Status</th><th>Flags</th><th>Created</th><th></th></tr></thead>
          <tbody>
            @for (s of filtered(); track s.id) {
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
  private auth = inject(AuthService);
  isEmitter = this.auth.hasRole('EMITTER');
  rows = signal<ShipmentDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  search = signal('');

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.rows().filter((s) => !q ||
      [s.passportCode, s.utilizerName, s.emitterName, s.transportProviderName, s.status, s.transportMode, s.sealNumber]
        .some((v) => (v ?? '').toString().toLowerCase().includes(q)));
  });

  isFlagged(s: ShipmentDto): boolean { return s.status === 'FLAGGED' || !!s.flags.length; }

  /**
   * How far along the chain of custody this shipment is. These are real stages the API reports,
   * not a live position estimate — the API carries no GPS or ETA.
   */
  stagePct(s: ShipmentDto): number {
    switch (s.status) {
      case 'REQUESTED': return 15;
      case 'ACCEPTED': return 40;
      case 'IN_TRANSIT': return 70;
      default: return 100;
    }
  }
  stageLabel(s: ShipmentDto): string {
    if (this.isFlagged(s)) return 'Flagged';
    switch (s.status) {
      case 'REQUESTED': return 'Awaiting carrier';
      case 'ACCEPTED': return 'Carrier assigned';
      case 'IN_TRANSIT': return 'In transit';
      case 'DELIVERED': return 'Delivered';
      default: return 'Closed';
    }
  }
  stageColour(s: ShipmentDto): string {
    if (this.isFlagged(s)) return '#ef4444';
    return s.status === 'DELIVERED' ? '#22c55e' : s.status === 'IN_TRANSIT' ? '#22c55e' : '#f59e0b';
  }

  constructor() {
    this.api.shipments().subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
