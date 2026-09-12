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
    @if (portalDesign) {
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
    @else if (portalDesign) {
      <div class="em-stack">
        @for (s of filtered(); track s.id) {
          <a class="em-trk" [class.bad]="isFlagged(s)" [routerLink]="['/shipments', s.id]">

            <!-- identity -->
            <div class="trk-head">
              <div>
                <div class="trk-ref">
                  <span class="ref">{{ shortRef(s) }}</span>
                  <app-status-badge [value]="s.status" />
                </div>
                <div class="trk-party">{{ s.utilizerName || 'Delivery' }}</div>
                <div class="trk-spec">{{ s.passportCode }} · {{ s.transportMode | label }} · {{ s.volumeTonnes | tonnes }}</div>
              </div>
              <div class="trk-carrier">
                <div class="l">Seal ref</div>
                <div class="v">{{ s.sealNumber || 'not sealed yet' }}</div>
                <div class="c">{{ s.ownTransport ? 'Own transport' : (s.transportProviderName || 'Awaiting a carrier') }}</div>
              </div>
            </div>

            <!-- route -->
            <div class="trk-route">
              <div class="end">
                <div class="l">From</div>
                <div class="v">{{ s.emitterName }}</div>
                <div class="d">{{ s.loadedAt ? (s.loadedAt | date:'mediumDate') : 'not dispatched' }}</div>
              </div>
              <div class="line">
                <span class="mid">{{ s.distanceKm | number:'1.0-0' }} km</span>
                <span class="arrow">→</span>
              </div>
              <div class="end r">
                <div class="l">To</div>
                <div class="v">{{ s.utilizerName }}</div>
                <div class="d">{{ s.deliveredAt ? (s.deliveredAt | date:'mediumDate') : 'in progress' }}</div>
              </div>
            </div>

            <!-- five-step tracker -->
            <div class="trk-prog">
              <div class="l">Progress</div>
              <ol class="trk-steps">
                @for (st of steps(s); track st.n) {
                  <li [class.on]="st.done" [class.flag]="st.flagged">
                    <span class="dot">@if (st.done) {<span aria-hidden="true">✓</span>} @else {{{ st.n }}}</span>
                    <span class="t">{{ st.title }}</span>
                    <span class="w">{{ st.when }}</span>
                  </li>
                }
              </ol>
            </div>

            @if (s.flags.length) {
              <div class="trk-flags">@for (f of s.flags; track f) {<span class="flag flag-red">{{ f | label }}</span>}</div>
            }
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
  /** Emitter and utilizer share the dark trading design. */
  portalDesign = this.auth.hasRole('EMITTER', 'UTILIZER');
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

  /** Short, real identifier: the shipment's own id, trimmed for display. */
  shortRef(s: ShipmentDto): string { return 'SHIP-' + s.id.replace(/-/g, '').slice(-6).toUpperCase(); }

  /**
   * The five real stages of the chain of custody. Every date shown is a timestamp the API
   * actually reports — there is no ETA, because the platform carries no live tracking.
   */
  steps(s: ShipmentDto): { n: number; title: string; when: string; done: boolean; flagged: boolean }[] {
    const moved = s.status === 'IN_TRANSIT' || s.status === 'DELIVERED' || s.status === 'FLAGGED';
    const assigned = moved || s.status === 'ACCEPTED' || s.ownTransport;
    const d = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—');
    return [
      { n: 1, title: 'Requested', when: d(s.createdAt), done: true, flagged: false },
      { n: 2, title: 'Carrier assigned', when: assigned ? (s.ownTransport ? 'own fleet' : 'assigned') : '—', done: assigned, flagged: false },
      { n: 3, title: 'Loaded & sealed', when: d(s.loadedAt), done: !!s.loadedAt, flagged: false },
      { n: 4, title: 'In transit', when: moved ? d(s.loadedAt) : '—', done: moved, flagged: false },
      { n: 5, title: this.isFlagged(s) ? 'Flagged' : 'Delivered', when: d(s.deliveredAt), done: !!s.deliveredAt, flagged: this.isFlagged(s) },
    ];
  }

  constructor() {
    this.api.shipments().subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
