import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AgreementDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-agreements-list',
  imports: [DatePipe, FormsModule, RouterLink, StatusBadge, MoneyPipe, TonnesPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <!-- Both trading portals use the design's card rows; other roles keep the table. -->
    @if (portalDesign) {
      <div class="em-ac-header">
        <h1>Agreements</h1>
        <div class="em-ac-tools">
          <div class="em-search">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
              <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" />
            </svg>
            <input [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Search agreements…" aria-label="Search agreements" />
          </div>
        </div>
      </div>
      <p class="em-ac-sub">Awarded tenders, won auctions and signed contracts. Sales become active only after lab approval.</p>
      <div class="tabs mb">
        @for (t of tabs; track t) {<button [class.active]="tab() === t" (click)="tab.set(t)">{{ t }}</button>}
      </div>
    } @else {
      <app-page-header title="Agreements" subtitle="Awarded tenders, won auctions and signed contracts. Sales become ACTIVE only after lab approval.">
        <div class="tabs" style="margin:0;border:0">
          @for (t of tabs; track t) {<button [class.active]="tab() === t" (click)="tab.set(t)">{{ t }}</button>}
        </div>
      </app-page-header>
    }

    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!filtered().length) {<app-empty-state message="No agreements in this view." />}
    @else if (portalDesign) {
      <div class="em-rows">
        @for (a of filtered(); track a.id) {
          <a class="em-row" [routerLink]="['/agreements', a.id]">
            <span class="rail" [style.background]="railColour(a.status)"></span>
            <span class="main">
              <span class="top">
                <span class="nm">{{ counterparty(a) }}</span>
                <app-status-badge [value]="a.status" />
              </span>
              <span class="sub">{{ shortRef(a) }} · {{ durationLabel(a) }}</span>
            </span>
            <span class="figs">
              <span class="v">{{ rateLabel(a) }}</span>
              <span class="m">{{ compact(a.totalValue) }}</span>
            </span>
            <span class="open">Open
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4" /></svg>
            </span>
          </a>
        }
      </div>
    } @else {
      <div class="card tight table-wrap">
        <table class="table">
          <thead><tr><th>Passport</th><th>Mode</th><th>Emitter</th><th>Utilizer</th><th class="r">Volume</th><th class="r">Price / t</th><th class="r">Value</th><th>Window</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (a of filtered(); track a.id) {
              <tr>
                <td class="mono">{{ a.passportCode }}</td>
                <td><app-status-badge [value]="a.mode" /></td>
                <td>{{ a.emitterName }}</td><td>{{ a.utilizerName }}</td>
                <td class="r">{{ a.volumeTonnes | tonnes }}@if (a.volumePerMonth) {<div class="muted small">{{ a.volumePerMonth | tonnes }}/mo × {{ a.durationMonths }}</div>}</td>
                <td class="r">{{ a.pricePerTonne | money }}</td>
                <td class="r">{{ a.totalValue | money }}</td>
                <td class="small">{{ a.startsAt | date:'mediumDate' }} → {{ a.endsAt | date:'mediumDate' }}</td>
                <td><app-status-badge [value]="a.status" /></td>
                <td><a class="btn btn-sm" [routerLink]="['/agreements', a.id]">Open</a></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }`,
})
export class AgreementsList {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  isEmitter = this.auth.hasRole('EMITTER');
  /** Emitter and utilizer share the dark trading design; the other four roles keep the table. */
  portalDesign = this.auth.hasRole('EMITTER', 'UTILIZER');
  rows = signal<AgreementDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  tabs = ['All', 'Active', 'Pending', 'Completed', 'Cancelled'];
  tab = signal('All');
  search = signal('');

  filtered = computed(() => {
    const t = this.tab();
    const q = this.search().trim().toLowerCase();
    return this.rows()
      .filter((a) => t === 'All' || (t === 'Active' && a.status === 'ACTIVE') || (t === 'Pending' && a.status === 'PENDING_VERIFICATION') || (t === 'Completed' && a.status === 'COMPLETED') || (t === 'Cancelled' && a.status === 'CANCELLED'))
      .filter((a) => !q || [a.passportCode, a.emitterName, a.utilizerName, a.mode, a.status].some((v) => (v ?? '').toString().toLowerCase().includes(q)));
  });

  /** The other side of the deal, since the emitter is always one party here. */
  counterparty(a: AgreementDto): string {
    return (this.isEmitter ? a.utilizerName : a.emitterName) || 'Counterparty';
  }
  /** The status rail down the left of each row, as in the design. */
  /** Short, real identifier taken from the end of the id, since seeded ids begin with zeros. */
  shortRef(a: AgreementDto): string { return 'AGR-' + a.id.replace(/-/g, '').slice(-6).toUpperCase(); }

  /** Contracts quote a monthly rate; one-off sales quote the lot. */
  rateLabel(a: AgreementDto): string {
    return a.volumePerMonth ? `${this.num(a.volumePerMonth)} t/mo` : `${this.num(a.volumeTonnes)} t`;
  }
  durationLabel(a: AgreementDto): string {
    const m = a.durationMonths ?? this.monthsBetween(a.startsAt, a.endsAt);
    if (!m) return 'single delivery';
    return `${m} month${m === 1 ? '' : 's'}`;
  }
  private monthsBetween(a?: string | null, b?: string | null): number {
    if (!a || !b) return 0;
    const s = new Date(a).getTime(), e = new Date(b).getTime();
    if (isNaN(s) || isNaN(e) || e <= s) return 0;
    return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24 * 30.44)));
  }
  private num(v: number): string { return Number.isInteger(v) ? String(v) : v.toFixed(1); }
  /** Indian short-scale money, as the reference shows it (₹5.8L). */
  compact(v?: number | null): string {
    const n = Number(v ?? 0);
    if (!n) return '₹0';
    if (n >= 1e7) return `₹${(n / 1e7).toFixed(n >= 1e8 ? 0 : 1)}Cr`;
    if (n >= 1e5) return `₹${(n / 1e5).toFixed(n >= 1e6 ? 0 : 1)}L`;
    if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
    return `₹${n}`;
  }

  railColour(status: string): string {
    switch (status) {
      case 'ACTIVE': return '#22c55e';
      case 'PENDING_VERIFICATION': return '#f59e0b';
      case 'COMPLETED': return '#64748b';
      default: return 'rgba(13,35,24,0.2)';
    }
  }

  constructor() {
    this.api.agreements().subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
