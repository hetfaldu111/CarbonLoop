import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuctionFilter, AuctionStateDto } from '../../core/models';
import { StatusBadge, TierBadge } from '../../shared/badges';
import { MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';
import { countdown } from '../shared/auction-room';

const TABS: { key: AuctionFilter; label: string; blurb: string }[] = [
  { key: 'live', label: 'Live now', blurb: 'Bidding is open. Each bid adds a fixed increment and the last bid when the clock stops wins.' },
  { key: 'upcoming', label: 'Upcoming', blurb: 'Scheduled lots. Open the room before the start time and it will go live in front of you.' },
  { key: 'ended', label: 'Ended', blurb: 'Closed lots and who won them.' },
];

@Component({
  selector: 'app-utilizer-auctions',
  imports: [DatePipe, RouterLink, StatusBadge, TierBadge, MoneyPipe, TonnesPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="CO₂ auctions" subtitle="Spot lots sold by ascending auction. Fixed increment per bid, binding commitment, last bid wins." />
    <app-alert [message]="error()" />

    <div class="tabs">
      @for (t of tabs; track t.key) {
        <button class="tab" [class.active]="tab() === t.key" (click)="select(t.key)">{{ t.label }}@if (counts()[t.key] !== null) {<span class="tab-count">{{ counts()[t.key] }}</span>}</button>
      }
    </div>
    <p class="muted small mb">{{ blurb() }}</p>

    @if (loading()) {<app-loading />}
    @else if (!rows().length) {<app-empty-state [message]="emptyMessage()" />}
    @else {
      <div class="grid grid-3">
        @for (a of rows(); track a.listingId) {
          <a class="card auction-card" [routerLink]="['/utilizer/auctions', a.listingId]">
            <div class="ac-top">
              <app-status-badge [value]="a.status" />
              @if (a.status === 'LIVE') {<span class="live-dot"></span><span class="muted small">{{ clock(a) }} left</span>}
              @else if (a.status === 'SCHEDULED') {<span class="muted small">opens {{ a.scheduledStartAt | date:'shortTime' }}</span>}
            </div>
            <div class="ac-price">{{ (a.currentPricePerTonne ?? a.basePricePerTonne) | money }}<span class="per">/t</span></div>
            <div class="muted small">
              @if (a.bidCount > 0) {{{ a.bidCount }} {{ a.bidCount === 1 ? 'bid' : 'bids' }} · opened at {{ a.basePricePerTonne | money }}}
              @else {no bids yet · opening price}
            </div>
            <dl class="ac-meta">
              <div><dt>Lot</dt><dd>{{ a.volumeTonnes | tonnes }}</dd></div>
              <div><dt>Purity</dt><dd>{{ a.concentrationPct }}%</dd></div>
              <div><dt>Increment</dt><dd>{{ a.bidIncrement | money }}/t</dd></div>
              <div><dt>Region</dt><dd>{{ a.city }}, {{ a.state }}</dd></div>
            </dl>
            @if (a.status !== 'LIVE' && a.status !== 'SCHEDULED' && a.leader) {
              <div class="ac-won">Won by {{ a.leader.displayName }} <app-tier-badge [tier]="a.leader.tier" /></div>
            } @else if (a.youAreLeading) {
              <div class="ac-won lead">You are leading this lot</div>
            }
          </a>
        }
      </div>
    }`,
})
export class UtilizerAuctions {
  private api = inject(ApiService);
  tabs = TABS;
  tab = signal<AuctionFilter>('live');
  rows = signal<AuctionStateDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  counts = signal<Record<AuctionFilter, number | null>>({ live: null, upcoming: null, ended: null });
  blurb = computed(() => TABS.find((t) => t.key === this.tab())!.blurb);
  emptyMessage = computed(() =>
    this.tab() === 'live' ? 'No auction is running right now. Check the upcoming tab.'
      : this.tab() === 'upcoming' ? 'Nothing is scheduled yet.'
        : 'No auctions have closed yet.');

  ngOnInit(): void {
    this.load();
    for (const t of TABS) {
      this.api.auctions(t.key).subscribe({ next: (r) => this.counts.update((c) => ({ ...c, [t.key]: r.length })), error: () => {} });
    }
  }
  select(t: AuctionFilter): void { if (t !== this.tab()) { this.tab.set(t); this.load(); } }
  load(): void {
    this.loading.set(true); this.error.set(null);
    this.api.auctions(this.tab()).subscribe({
      next: (r) => { this.rows.set(r); this.counts.update((c) => ({ ...c, [this.tab()]: r.length })); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
  clock(a: AuctionStateDto): string { return countdown(a.secondsRemaining); }
}
