import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { INDIAN_STATES, ListingDto } from '../../core/models';
import { LabelPipe, MoneyPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-marketplace',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, LabelPipe, MoneyPipe, Alert, EmptyState, Loading],
  template: `
    <div class="em-page">

      <div class="em-head">
        <h1 class="em-h1">Marketplace</h1>
        <span class="em-spacer"></span>
        <div class="em-search">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" />
          </svg>
          <input [ngModel]="term()" (ngModelChange)="term.set($event)" placeholder="Search listings..." aria-label="Search listings" />
        </div>
        <select class="em-select" [(ngModel)]="mode" (ngModelChange)="load()" aria-label="Filter by mode">
          <option value="">All</option><option value="TENDER">Tender</option><option value="AUCTION">Auction</option>
        </select>
        <select class="em-select" [(ngModel)]="state" (ngModelChange)="load()" aria-label="Filter by state">
          <option value="">All</option>@for (s of states; track s) {<option [value]="s">{{ s }}</option>}
        </select>
      </div>

      <app-alert [message]="error()" />
      @if (loading()) {<app-loading />}
      @else {
        <p class="em-count-line">{{ shown().length }} listing{{ shown().length === 1 ? '' : 's' }} available</p>

        @if (!shown().length) {<app-empty-state message="No open listings match your filters." icon="▣" />}

        @for (l of shown(); track l.id) {
          <article class="em-mk">
            <div class="em-mk-top">
              <div class="em-mk-id">
                <span class="em-pid">{{ l.passportCode }}</span>
                <span class="em-badge verified">✓ Verified</span>
                @if (l.mode === 'AUCTION') {<span class="em-badge auction">{{ l.status | label }}</span>}
              </div>
              <div class="em-mk-price">
                <div class="v">{{ (l.mode === 'AUCTION' ? (l.currentPricePerTonne ?? l.basePricePerTonne) : l.basePricePerTonne) | money }}</div>
                <div class="u">/tonne@if (l.mode === 'AUCTION' && l.bidCount) { · {{ l.bidCount }} bid{{ l.bidCount === 1 ? '' : 's' }}}</div>
              </div>
            </div>

            <h3 class="em-mk-title">{{ l.captureTechnology }} · {{ l.physicalState | label }}</h3>
            <p class="em-mk-seller">
              @if (l.emitterName) {<strong>{{ l.emitterName }}</strong>} @else {<span class="hidden-id">Supplier revealed once you propose</span>}
              — {{ l.city }}, {{ l.state }}
            </p>

            <div class="em-mk-stats">
              <div class="em-mk-stat"><span class="k">Purity</span><span class="v">{{ l.concentrationPct | number:'1.1-1' }}%</span></div>
              <div class="em-mk-stat"><span class="k">Available</span><span class="v">{{ l.volumeTonnes | number:'1.0-0' }}t</span></div>
              <div class="em-mk-stat">
                <span class="k">{{ l.mode === 'AUCTION' && l.status === 'SCHEDULED' ? 'Opens' : 'Closes' }}</span>
                <span class="v">{{ (l.mode === 'AUCTION' && l.status === 'SCHEDULED' ? l.scheduledStartAt : l.closesAt) | date:'d MMM' }}</span>
              </div>
            </div>

            <div class="em-mk-foot">
              <div class="em-mk-tags">
                <span class="em-tag">{{ l.physicalState | label }}</span>
                <span class="em-tag">{{ l.carbonOrigin | label }}</span>
                <span class="em-tag">min {{ l.minPurityPct }}%</span>
                @if (windowDays(l); as d) {<span class="em-tag">🚚 {{ d }}d window</span>}
                @if (l.pipelineConnected) {<span class="em-tag">pipeline</span>}
              </div>
              @if (l.mode === 'AUCTION') {
                <a class="em-btn em-btn-dark" [routerLink]="['/utilizer/auctions', l.id]">{{ l.status === 'LIVE' ? 'Join Auction' : 'View Auction' }}</a>
              } @else {
                <a class="em-btn em-btn-dark" [routerLink]="['/utilizer/listings', l.id]">Make Proposal</a>
              }
            </div>
          </article>
        }
      }
    </div>`,
})
export class Marketplace {
  private api = inject(ApiService);
  states = INDIAN_STATES;
  rows = signal<ListingDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  mode = ''; state = '';
  /** Free-text search runs client-side over what has already loaded. */
  term = signal('');

  shown = computed(() => {
    const t = this.term().trim().toLowerCase();
    if (!t) return this.rows();
    return this.rows().filter((l) =>
      [l.passportCode, l.captureTechnology, l.physicalState, l.carbonOrigin, l.city, l.state, l.mode]
        .some((v) => (v ?? '').toString().toLowerCase().includes(t)));
  });

  /** Length of the real delivery window. Not a lead time; the API has no such field. */
  windowDays(l: ListingDto): number | null {
    if (!l.deliveryWindowStart || !l.deliveryWindowEnd) return null;
    const ms = new Date(l.deliveryWindowEnd).getTime() - new Date(l.deliveryWindowStart).getTime();
    const d = Math.round(ms / 86400000);
    return d > 0 ? d : null;
  }

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    // No status filter: the API's default already returns OPEN tenders plus SCHEDULED and LIVE
    // auctions. Passing status:'OPEN' would hide every auction, since auctions are never OPEN.
    this.api.listings({ mode: this.mode || undefined, state: this.state || undefined }).subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
