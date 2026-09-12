import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ListingDto } from '../../core/models';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, Loading } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-emitter-listings',
  imports: [DatePipe, FormsModule, RouterLink, LabelPipe, MoneyPipe, TonnesPipe, Alert, Loading],
  template: `
    <div class="em-page">
      <div class="em-head">
        <h1 class="em-h1">Listings</h1>
        <span class="em-spacer"></span>
        <div class="em-search">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="rgba(13,35,24,0.35)" stroke-width="1.5" stroke-linecap="round"><circle cx="6.5" cy="6.5" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /></svg>
          <input [ngModel]="term()" (ngModelChange)="term.set($event)" name="q" placeholder="Search listings…" aria-label="Search listings" />
        </div>
        <a class="em-btn em-btn-green" routerLink="/emitter/listings/new">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 2v10M2 7h10" /></svg>
          New listing
        </a>
      </div>

      <app-alert [message]="error()" />
      @if (loading()) {<app-loading />}
      @else if (!filtered().length) {
        <div class="em-card"><div class="em-empty"><span class="ico">▣</span>{{ rows().length ? 'No listings match that search.' : 'No listings yet. Publish volume from a verified passport.' }}</div></div>
      }
      @else {
        <div class="em-grid em-grid-auto">
          @for (l of filtered(); track l.id) {
            <a class="em-tile" [routerLink]="linkFor(l)">
              <div class="em-stripe" [style.background]="modeCol(l.mode)"></div>
              <div class="em-tile-body">
                <div class="em-tile-head">
                  <div>
                    <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;flex-wrap:wrap">
                      <span class="em-mode-pill" [style.background]="modeBg(l.mode)" [style.color]="modeCol(l.mode)">{{ l.mode | label }}</span>
                      <span class="em-badge" [class]="'em-badge ' + statusClass(l.status)">{{ l.status | label }}</span>
                    </div>
                    <div class="em-pid">{{ l.passportCode }}</div>
                  </div>
                  <div>
                    <div class="em-tile-vol">{{ l.volumeTonnes | tonnes }}</div>
                    <div class="em-mono" style="text-align:right;margin-top:2px">volume</div>
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;margin-bottom:14px">
                  <div><div class="em-f-label">Base price</div><div class="em-f-value sm">{{ l.basePricePerTonne | money:0 }}/t</div></div>
                  <div><div class="em-f-label">Min purity</div><div class="em-f-value sm">{{ l.minPurityPct }}%</div></div>
                  @if (l.mode === 'AUCTION') {
                    <div><div class="em-f-label">Increment</div><div class="em-f-value sm">{{ l.bidIncrement | money:0 }}/t</div></div>
                    <div><div class="em-f-label">{{ l.status === 'SCHEDULED' ? 'Opens' : 'Closes' }}</div><div class="em-f-value sm">{{ (l.status === 'SCHEDULED' ? l.scheduledStartAt : l.closesAt) | date:'MMM d, h:mm a' }}</div></div>
                  } @else {
                    <div><div class="em-f-label">Delivery</div><div class="em-f-value sm">{{ l.deliveryWindowStart | date:'MMM d' }} → {{ l.deliveryWindowEnd | date:'MMM d, y' }}</div></div>
                    <div><div class="em-f-label">Closes</div><div class="em-f-value sm">{{ l.closesAt | date:'MMM d, h:mm a' }}</div></div>
                  }
                </div>

                <div class="em-tile-foot">
                  @if (l.mode === 'AUCTION') {
                    <span><strong style="color:#0d2318">{{ l.bidCount || 0 }}</strong> bid{{ l.bidCount === 1 ? '' : 's' }}</span>
                  } @else {
                    <span><strong style="color:#0d2318">{{ l.proposalCount || 0 }}</strong> proposal{{ l.proposalCount === 1 ? '' : 's' }}</span>
                  }
                  <span class="em-link">Open →</span>
                </div>
              </div>
            </a>
          }
        </div>
      }
    </div>`,
})
export class EmitterListings {
  private api = inject(ApiService);
  rows = signal<ListingDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  term = signal('');

  filtered = computed(() => {
    const t = this.term().trim().toLowerCase();
    if (!t) return this.rows();
    return this.rows().filter((l) =>
      [l.passportCode, l.mode, l.status, l.description].some((v) => (v || '').toString().toLowerCase().includes(t)));
  });

  /** Auctions open their live room; tenders and contracts open the listing detail. */
  linkFor(l: ListingDto): string[] {
    return l.mode === 'AUCTION' ? ['/emitter/auctions', l.id] : ['/emitter/listings', l.id];
  }
  modeCol(m: string): string { return m === 'AUCTION' ? '#f59e0b' : m === 'CONTRACT' ? '#8b5cf6' : '#22c55e'; }
  modeBg(m: string): string { return m === 'AUCTION' ? '#fef3c7' : m === 'CONTRACT' ? '#ede9fe' : '#dcfce7'; }
  statusClass(s: string): string {
    const k = (s || '').toLowerCase();
    if (k === 'open' || k === 'live') return 'open';
    if (k === 'scheduled') return 'scheduled';
    if (k === 'awarded') return 'awarded';
    return 'closed';
  }

  constructor() {
    this.api.myListings().subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
