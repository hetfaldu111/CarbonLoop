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
        <div class="grid grid-2 mb">
          @for (a of live(); track a.listingId) {
            <div class="card auction-card live-card">
              <div class="ac-top">
                <a class="mono" [routerLink]="['/emitter/auctions', a.listingId]">{{ a.passportCode }}</a>
                <app-status-badge [value]="a.status" />
                <span class="muted small">{{ clock(a) }} left</span>
              </div>
              <div class="ac-price">{{ (a.currentPricePerTonne ?? a.basePricePerTonne) | money }}<span class="per">/t</span></div>
              <div class="muted small">{{ a.bidCount }} {{ a.bidCount === 1 ? 'bid' : 'bids' }} · lot total {{ (a.currentTotal ?? a.basePricePerTonne * a.volumeTonnes) | money }} · opened at {{ a.basePricePerTonne | money }}/t (+{{ a.bidIncrement | money }} per bid)</div>
              @if (a.leader) {
                <div class="ac-won lead">Leading: {{ a.leader.displayName }} <app-tier-badge [tier]="a.leader.tier" /></div>
              } @else {
                <div class="ac-won muted">No bids yet</div>
              }
              @if (a.bids.length) {
                <table class="table compact mt">
                  <thead><tr><th>Bidder</th><th class="r">Price / t</th><th>Placed</th></tr></thead>
                  <tbody>@for (b of a.bids.slice(0, 4); track b.placedAt) {
                    <tr><td>{{ b.displayName }}</td><td class="r">{{ b.amountPerTonne | money }}</td><td>{{ b.placedAt | date:'HH:mm:ss' }}</td></tr>
                  }</tbody>
                </table>
              }
              <a class="btn btn-sm mt" [routerLink]="['/emitter/auctions', a.listingId]">Open the room</a>
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
}
