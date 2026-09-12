import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import { ListingDto, ProposalDto } from '../../core/models';
import { MoneyPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

/** A proposal plus the listing it was made against, which carries the emitter and the spec. */
interface Row {
  p: ProposalDto;
  l?: ListingDto;
}

@Component({
  selector: 'app-my-proposals',
  imports: [DatePipe, FormsModule, MoneyPipe, Alert, EmptyState, Loading],
  template: `
    <h1 class="up-title">My Proposals</h1>

    <div class="up-search">
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
        <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" />
      </svg>
      <input [ngModel]="search()" (ngModelChange)="search.set($event)"
             placeholder="Search by emitter, proposal ID, type, status, price…" aria-label="Search proposals" />
    </div>

    @if (chips().length) {
      <div class="up-filters">
        <span class="up-filters-label">Filter by:</span>
        @for (c of chips(); track c.key) {
          <button type="button" class="up-chip" [class.on]="chip() === c.key" (click)="toggleChip(c.key)">{{ c.label }}</button>
        }
      </div>
    }

    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else {
      <p class="up-count">{{ filtered().length }} {{ filtered().length === 1 ? 'proposal' : 'proposals' }}</p>

      @if (!filtered().length) {
        <app-empty-state message="No proposals match this view." icon="✉" />
      } @else {
        @for (r of filtered(); track r.p.id) {
          <div class="up-card">
            <div class="up-card-head">
              <span class="up-ref">{{ ref(r.p) }}</span>
              <span class="up-pill" [class]="'up-pill ' + tone(r.p.status)">{{ statusLabel(r.p.status) }}</span>
              <span class="up-dates">
                Submitted {{ r.p.createdAt | date:'yyyy-MM-dd' }}@if (r.l?.closesAt) { · Closes {{ r.l!.closesAt | date:'yyyy-MM-dd' }}}
              </span>
            </div>

            <div class="up-card-body">
              <div class="up-card-main">
                <h3>{{ r.l?.emitterName || 'Supplier revealed once you propose' }}</h3>
                <p class="up-spec">{{ spec(r) }}</p>
                @if (note(r.p); as n) {<p class="up-note">“{{ n }}”</p>}
              </div>

              <div class="up-card-offer">
                <span class="up-offer-label">YOUR OFFER</span>
                <span class="up-offer-price">{{ r.p.offeredPricePerTonne | money }}/t</span>
                <span class="up-offer-sub">{{ r.p.quantityTonnes }}t · {{ total(r.p) | money }}</span>
                @if (r.p.status === 'SUBMITTED') {
                  <button type="button" class="up-withdraw" (click)="withdraw(r.p)" [disabled]="busy()">Withdraw</button>
                }
              </div>
            </div>
          </div>
        }
      }
    }`,
})
export class MyProposals {
  private api = inject(ApiService);
  private router = inject(Router);
  rows = signal<Row[]>([]);
  loading = signal(true);
  busy = signal(false);
  error = signal<string | null>(null);
  search = signal('');
  chip = signal<string | null>(null);

  /** Only offer a chip for a status the buyer actually has, so none of them ever return nothing. */
  chips = computed(() => {
    const present = new Set(this.rows().map((r) => r.p.status));
    return [
      { key: 'SUBMITTED', label: 'awaiting' },
      { key: 'AWARDED', label: 'accepted' },
      { key: 'REJECTED', label: 'rejected' },
      { key: 'WITHDRAWN', label: 'withdrawn' },
    ].filter((c) => present.has(c.key as ProposalDto['status']));
  });

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const c = this.chip();
    return this.rows()
      .filter((r) => !c || r.p.status === c)
      .filter((r) => {
        if (!q) return true;
        const hay = [
          this.ref(r.p), r.l?.emitterName, r.l?.passportCode, r.p.listingMode,
          this.statusLabel(r.p.status), String(r.p.offeredPricePerTonne), String(r.p.quantityTonnes),
          r.l?.captureTechnology, r.p.deliveryRequirement, r.p.otherRequirements,
        ];
        return hay.some((v) => (v ?? '').toString().toLowerCase().includes(q));
      });
  });

  /** Short reference from the END of the id: seeded ids begin with a long run of zeros. */
  ref(p: ProposalDto): string { return 'PROP-' + p.id.replace(/-/g, '').slice(-6).toUpperCase(); }

  statusLabel(s: string): string {
    return s === 'SUBMITTED' ? 'Awaiting emitter'
      : s === 'AWARDED' ? 'Accepted'
      : s.charAt(0) + s.slice(1).toLowerCase();
  }
  tone(s: string): string {
    return s === 'AWARDED' ? 'ok' : s === 'REJECTED' ? 'no' : s === 'WITHDRAWN' ? 'off' : 'wait';
  }

  /** The stream this proposal was made against, from the listing the API returned. */
  spec(r: Row): string {
    const parts = [
      r.l?.captureTechnology,
      r.l?.physicalState ? r.l.physicalState.charAt(0) + r.l.physicalState.slice(1).toLowerCase() : null,
      r.l ? `${r.l.concentrationPct}% CO₂` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : `${r.p.listingMode.charAt(0)}${r.p.listingMode.slice(1).toLowerCase()} proposal`;
  }
  /** The buyer's own words, where they left any. */
  note(p: ProposalDto): string | null {
    return (p.otherRequirements || '').trim() || (p.deliveryRequirement || '').trim() || null;
  }
  total(p: ProposalDto): number { return p.quantityTonnes * p.offeredPricePerTonne; }

  toggleChip(k: string): void { this.chip.update((c) => (c === k ? null : k)); }

  constructor() {
    this.api.myProposals().subscribe({
      next: (ps) => {
        if (!ps.length) { this.rows.set([]); this.loading.set(false); return; }
        // Proposals carry only a listing id; the listing holds the emitter and the spec.
        const unique = [...new Set(ps.map((p) => p.listingId))];
        forkJoin(unique.map((id) => this.api.listing(id).pipe(catchError(() => of(null))))).subscribe((ls) => {
          const byId = new Map<string, ListingDto>();
          ls.forEach((l) => { if (l) byId.set(l.id, l); });
          this.rows.set(ps.map((p) => ({ p, l: byId.get(p.listingId) })));
          this.loading.set(false);
        });
      },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }

  withdraw(p: ProposalDto): void {
    this.busy.set(true);
    this.api.withdrawProposal(p.id).subscribe({
      next: (pr) => {
        this.rows.update((rs) => rs.map((r) => (r.p.id === pr.id ? { ...r, p: pr } : r)));
        this.busy.set(false);
      },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
}
