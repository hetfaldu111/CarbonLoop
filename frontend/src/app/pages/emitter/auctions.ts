import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuctionStateDto } from '../../core/models';
import { StatusBadge, TierBadge } from '../../shared/badges';
import { MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';
import { countdown } from '../shared/auction-room';

@Component({
  selector: 'app-emitter-auctions',
  imports: [DatePipe, RouterLink, StatusBadge, TierBadge, MoneyPipe, TonnesPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="My auctions" subtitle="Live tracking of every lot you put up. Bidder names are shown in full because you are the seller.">
      <a class="btn btn-primary btn-sm" routerLink="/emitter/listings/new">Schedule an auction</a>
    </app-page-header>
    <app-alert [message]="error()" />

    @if (loading()) {<app-loading />}
    @else if (!rows().length) {<app-empty-state message="You have not scheduled any auctions yet." />}
    @else {
      @if (live().length) {
        <h3 class="section-title">Live now <span class="live-dot"></span></h3>
        <div class="em-stack mb">
          @for (a of live(); track a.listingId) {
            <div class="em-ac">
              <!-- header: identity left, countdown right -->
              <div class="em-ac-head">
                <div>
                  <div class="em-ac-tags">
                    <span class="badge status-auction">Auction</span>
                    <span class="em-mono">{{ a.passportCode }}</span>
                  </div>
                  <div class="em-ac-title">{{ a.volumeTonnes | tonnes }} lot · {{ a.concentrationPct }}% CO₂</div>
                  <div class="em-ac-meta">
                    <span>Base {{ a.basePricePerTonne | money }}/t</span><span>·</span>
                    <span>Min raise {{ a.bidIncrement | money }}/t</span><span>·</span>
                    <span>{{ a.city }}, {{ a.state }}</span>
                  </div>
                </div>
                <div class="em-ac-timer">
                  <div class="em-mono-label">Time remaining</div>
                  <div class="em-ac-clock" [style.color]="urgency(a)">{{ clock(a) }}</div>
                  @if (a.secondsRemaining < 300) {<div class="em-ac-soon">⚡ Closing soon</div>}
                </div>
              </div>

              <div class="em-ac-body">
                <!-- left: the standing bid -->
                <div class="em-ac-left">
                  <div class="em-mono-label">Current highest bid</div>
                  <div class="em-ac-price">{{ (a.currentPricePerTonne ?? a.basePricePerTonne) | money }}<span>/t</span></div>
                  <div class="em-ac-total">Total value: {{ (a.currentTotal ?? a.basePricePerTonne * a.volumeTonnes) | money }}</div>
                  @if (a.leader) {
                    <div class="em-ac-winner">
                      <span class="n">1</span>
                      <div>
                        <div class="em-strong">{{ a.leader.displayName }}</div>
                        <app-tier-badge [tier]="a.leader.tier" />
                      </div>
                    </div>
                  } @else {
                    <div class="em-ac-nobids">No bids yet. The lot opens at {{ a.basePricePerTonne | money }}/t.</div>
                  }
                  <div class="em-ac-next">
                    <div class="l">Next bid will be at least</div>
                    <div class="v">{{ a.nextBidPricePerTonne | money }}/t</div>
                  </div>
                </div>

                <!-- right: real bid history -->
                <div class="em-ac-right">
                  <div class="em-mono-label">Bid history · {{ a.bidCount }} {{ a.bidCount === 1 ? 'bid' : 'bids' }}</div>
                  @if (a.bids.length) {
                    <table class="table compact">
                      <thead><tr><th>Bidder</th><th class="r">Price / t</th><th class="r">Lot total</th><th>Placed</th></tr></thead>
                      <tbody>@for (b of a.bids.slice(0, 6); track b.placedAt) {
                        <tr><td>{{ b.displayName }} <app-tier-badge [tier]="b.tier" /></td><td class="r">{{ b.amountPerTonne | money }}</td><td class="r">{{ b.totalAmount | money }}</td><td class="em-mono">{{ b.placedAt | date:'HH:mm:ss' }}</td></tr>
                      }</tbody>
                    </table>
                  } @else {<div class="em-empty"><span class="ico">◌</span>Nobody has bid yet.</div>}
                  <a class="em-btn em-btn-out em-btn-sm" [routerLink]="['/emitter/auctions', a.listingId]">Open the room →</a>
                </div>
              </div>
            </div>
          }
        </div>
      }

      @if (upcoming().length) {
        <h3 class="section-title">Scheduled</h3>
        <div class="table-wrap mb"><table class="table">
          <thead><tr><th>Passport</th><th class="r">Lot</th><th class="r">Opening</th><th class="r">Increment</th><th>Opens</th><th>Closes</th><th></th></tr></thead>
          <tbody>@for (a of upcoming(); track a.listingId) {
            <tr>
              <td class="mono">{{ a.passportCode }}</td>
              <td class="r">{{ a.volumeTonnes | tonnes }}</td>
              <td class="r">{{ a.basePricePerTonne | money }}</td>
              <td class="r">{{ a.bidIncrement | money }}</td>
              <td>{{ a.scheduledStartAt | date:'medium' }}</td>
              <td>{{ a.closesAt | date:'shortTime' }}</td>
              <td><a class="btn btn-sm" [routerLink]="['/emitter/auctions', a.listingId]">Open</a></td>
            </tr>
          }</tbody>
        </table></div>
      }

      @if (ended().length) {
        <h3 class="section-title">Closed</h3>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Passport</th><th>Status</th><th class="r">Lot</th><th class="r">Final price</th><th class="r">Lot total</th><th>Winner</th><th></th></tr></thead>
          <tbody>@for (a of ended(); track a.listingId) {
            <tr>
              <td class="mono">{{ a.passportCode }}</td>
              <td><app-status-badge [value]="a.status" /></td>
              <td class="r">{{ a.volumeTonnes | tonnes }}</td>
              <td class="r">@if (a.bidCount) {{{ a.currentPricePerTonne | money }}} @else {<span class="muted">no bids</span>}</td>
              <td class="r">@if (a.bidCount) {{{ a.currentTotal | money }}} @else {—}</td>
              <td>@if (a.leader) {{{ a.leader.displayName }} <app-tier-badge [tier]="a.leader.tier" />} @else {<span class="muted">volume returned to stock</span>}</td>
              <td class="nowrap">
                <a class="btn btn-sm" [routerLink]="['/emitter/auctions', a.listingId]">Open</a>
                @if (a.agreementId) {<a class="btn btn-sm" [routerLink]="['/agreements', a.agreementId]">Agreement</a>}
              </td>
            </tr>
          }</tbody>
        </table></div>
      }
    }`,
})
export class EmitterAuctions implements OnDestroy {
  private api = inject(ApiService);
  rows = signal<AuctionStateDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  private poll?: ReturnType<typeof setInterval>;

  live = computed(() => this.rows().filter((a) => a.status === 'LIVE'));
  upcoming = computed(() => this.rows().filter((a) => a.status === 'SCHEDULED'));
  ended = computed(() => this.rows().filter((a) => a.status !== 'LIVE' && a.status !== 'SCHEDULED'));

  ngOnInit(): void { this.load(true); this.poll = setInterval(() => this.load(false), 3000); }
  ngOnDestroy(): void { if (this.poll) clearInterval(this.poll); }

  load(first: boolean): void {
    this.api.myAuctions().subscribe({
      next: (r) => { this.rows.set(r); if (first) this.loading.set(false); },
      error: (e) => { if (first) { this.error.set(errMsg(e)); this.loading.set(false); } },
    });
  }
  clock(a: AuctionStateDto): string { return countdown(a.secondsRemaining); }
  /** Green with time in hand, amber under 15 minutes, red under 5 — as in the design. */
  urgency(a: AuctionStateDto): string {
    const s = a.secondsRemaining ?? 0;
    return s < 300 ? '#ef4444' : s < 900 ? '#f59e0b' : '#22c55e';
  }
}
