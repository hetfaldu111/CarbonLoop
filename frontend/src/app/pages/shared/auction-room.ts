import { Component, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AuctionStateDto } from '../../core/models';
import { StatusBadge, TierBadge } from '../../shared/badges';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

/** Formats a second count as m:ss / h:mm:ss. */
export function countdown(sec: number): string {
  if (sec <= 0) return '0:00';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

@Component({
  selector: 'app-auction-room',
  imports: [DatePipe, RouterLink, StatusBadge, TierBadge, LabelPipe, MoneyPipe, TonnesPipe, Alert, Loading, PageHeader],
  template: `
    @if (loading()) {<app-loading />}
    <app-alert [message]="error()" />
    <app-alert [message]="ok()" tone="success" />

    @if (a(); as a) {
      <app-page-header
        [title]="'Auction · ' + a.passportCode"
        [subtitle]="(a.volumeTonnes | tonnes) + ' of ' + a.concentrationPct + '% CO₂ · ' + a.city + ', ' + a.state">
        <app-status-badge [value]="a.status" />
        @if (isEmitter()) {<a class="btn btn-sm" routerLink="/emitter/auctions">All my auctions</a>}
        @else {<a class="btn btn-sm" routerLink="/utilizer/auctions">All auctions</a>}
      </app-page-header>

      <!-- ===== SCHEDULED ===== -->
      @if (a.status === 'SCHEDULED') {
        <div class="card auction-hero upcoming">
          <div class="ah-label">Bidding opens</div>
          <div class="ah-price">{{ startsIn() }}</div>
          <div class="ah-sub">{{ a.scheduledStartAt | date:'medium' }} · runs for {{ durationLabel(a) }}</div>
          <div class="ah-row">
            <div><div class="label">Opening price</div><div class="v">{{ a.basePricePerTonne | money }}/t</div></div>
            <div><div class="label">Each bid adds</div><div class="v">{{ a.bidIncrement | money }}/t</div></div>
            <div><div class="label">Lot size</div><div class="v">{{ a.volumeTonnes | tonnes }}</div></div>
          </div>
          <p class="muted small mt">This page updates itself. When the auction opens the bidding controls appear here automatically.</p>
        </div>
      }

      <!-- ===== LIVE ===== -->
      @else if (a.status === 'LIVE') {
        <div class="card auction-hero live" [class.leading]="a.youAreLeading">
          <div class="ah-label">
            @if (a.bidCount === 0) {No bids yet — opening price} @else {Current bid}
            <span class="live-dot" title="Updating every 2 seconds"></span>
          </div>
          <div class="ah-price">{{ (a.currentPricePerTonne ?? a.basePricePerTonne) | money }}<span class="per">/t</span></div>
          <div class="ah-sub">
            @if (a.bidCount > 0) {{{ a.currentTotal | money }} for the {{ a.volumeTonnes | tonnes }} lot · {{ a.bidCount }} {{ a.bidCount === 1 ? 'bid' : 'bids' }}}
            @else {{{ a.volumeTonnes | tonnes }} lot · be the first to bid}
          </div>

          <div class="ah-clock" [class.urgent]="remaining() <= 60">
            <div class="label">Closes in</div>
            <div class="clock">{{ countdownLabel() }}</div>
            @if (remaining() <= 60) {<div class="muted small">A bid in the last minute extends the clock by a minute.</div>}
          </div>

          @if (a.youAreLeading) {
            <div class="ah-state you-lead">You are the leading bidder at {{ (a.currentPricePerTonne ?? 0) | money }}/t.</div>
          } @else if (youHaveBid()) {
            <div class="ah-state outbid">You have been outbid. Bid again to retake the lead.</div>
          }

          @if (!isEmitter()) {
            <div class="bid-panel">
              @if (a.canBid) {
                @if (!accepted()) {
                  <label class="binding">
                    <input type="checkbox" [checked]="accepted()" (change)="accepted.set(!accepted())" />
                    <span>{{ a.bindingTerms }}</span>
                  </label>
                }
                <button class="btn btn-primary btn-bid" (click)="bid()" [disabled]="busy() || !accepted()">
                  Bid {{ a.nextBidPricePerTonne | money }}/t · commit {{ nextTotal() | money }}
                </button>
                @if (!accepted()) {<div class="muted small">Tick the commitment above to enable bidding.</div>}
                @else {<div class="muted small">Your bid is binding. The server sets the amount; each bid adds exactly {{ a.bidIncrement | money }}/t.</div>}
              } @else {
                <div class="alert alert-warn">{{ a.blockedReason || 'You cannot bid in this auction.' }}</div>
              }
            </div>
          } @else {
            <div class="bid-panel"><div class="alert alert-info">You are the seller. You are watching your own auction; bidder names are shown in full below.</div></div>
          }
        </div>
      }

      <!-- ===== ENDED ===== -->
      @else {
        <div class="card auction-hero ended">
          <div class="ah-label">Auction closed</div>
          @if (a.bidCount > 0 && a.leader) {
            <div class="ah-price">{{ (a.currentPricePerTonne ?? 0) | money }}<span class="per">/t</span></div>
            <div class="ah-sub">Won by <strong>{{ a.leader.displayName }}</strong>@if (a.leader.isYou) { — that's you} · {{ a.currentTotal | money }} for {{ a.volumeTonnes | tonnes }}</div>
            @if (a.agreementId) {<div class="mt"><a class="btn btn-primary" [routerLink]="['/agreements', a.agreementId]">Open the agreement</a></div>}
          } @else {
            <div class="ah-price">No bids</div>
            <div class="ah-sub">The lot closed without a bid and the volume returned to the emitter's free stock.</div>
          }
        </div>
      }

      <!-- ===== Bid history ===== -->
      <div class="card mt">
        <h3>Bid history
          <span class="muted small">—
            @if (isEmitter()) {you see real company names as the seller}
            @else {rival bidders are shown by pseudonym while the auction is open}
          </span>
        </h3>
        @if (!a.bids.length) {<p class="muted">No bids placed yet.</p>}
        @else {
          <div class="table-wrap"><table class="table compact">
            <thead><tr><th></th><th>Bidder</th><th>Tier</th><th class="r">Price / t</th><th class="r">Lot total</th><th>Placed</th></tr></thead>
            <tbody>@for (b of a.bids; track b.placedAt; let i = $index) {
              <tr [class.highlight]="i === 0" [class.picked]="b.isYou">
                <td>{{ i === 0 ? '★' : '' }}</td>
                <td>{{ b.displayName }}@if (b.isYou) {<span class="badge status-info" style="margin-left:.4rem">you</span>}</td>
                <td><app-tier-badge [tier]="b.tier" /></td>
                <td class="r"><strong>{{ b.amountPerTonne | money }}</strong></td>
                <td class="r">{{ b.totalAmount | money }}</td>
                <td>{{ b.placedAt | date:'HH:mm:ss' }}</td>
              </tr>
            }</tbody>
          </table></div>
        }
      </div>

      <div class="card mt">
        <h3>Lot details</h3>
        <dl class="kv">
          <dt>Passport</dt><dd class="mono">{{ a.passportCode }} · {{ a.concentrationPct }}% CO₂</dd>
          <dt>Volume</dt><dd>{{ a.volumeTonnes | tonnes }}</dd>
          <dt>Opening price</dt><dd>{{ a.basePricePerTonne | money }}/t</dd>
          <dt>Increment</dt><dd>{{ a.bidIncrement | money }}/t per bid</dd>
          <dt>Window</dt><dd>{{ a.scheduledStartAt | date:'medium' }} → {{ a.closesAt | date:'medium' }}</dd>
          <dt>Location</dt><dd>{{ a.city }}, {{ a.state }}</dd>
          @if (a.emitterName) {<dt>Seller</dt><dd>{{ a.emitterName }} <app-tier-badge [tier]="a.emitterTier" /></dd>}
          @else {<dt>Seller</dt><dd class="muted">Identity revealed to the winner when the auction closes <app-tier-badge [tier]="a.emitterTier" /></dd>}
          <dt>Mode</dt><dd>{{ 'AUCTION' | label }} — ascending, fixed increment, last bid wins</dd>
        </dl>
      </div>
    }`,
})
export class AuctionRoom implements OnDestroy {
  id = input.required<string>();
  private api = inject(ApiService);
  private auth = inject(AuthService);
  a = signal<AuctionStateDto | null>(null);
  loading = signal(true);
  busy = signal(false);
  accepted = signal(false);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);
  /** Seconds left, seeded from the server on every poll and ticked down locally in between. */
  remaining = signal(0);
  private poll?: ReturnType<typeof setInterval>;
  private tick?: ReturnType<typeof setInterval>;

  isEmitter = computed(() => this.auth.hasRole('EMITTER'));
  youHaveBid = computed(() => !!this.a()?.bids?.some((b) => b.isYou));
  countdownLabel = computed(() => countdown(this.remaining()));
  nextTotal = computed(() => { const a = this.a(); return a ? a.nextBidPricePerTonne * a.volumeTonnes : 0; });
  startsIn = computed(() => {
    const a = this.a();
    if (!a) return '';
    return countdown(Math.max(0, Math.round((new Date(a.scheduledStartAt).getTime() - this.serverNow()) / 1000)));
  });

  /** Local clock corrected by the server's own time, so drift on this machine never shows. */
  private serverOffsetMs = signal(0);
  private nowTick = signal(Date.now());
  private serverNow(): number { return this.nowTick() - this.serverOffsetMs(); }

  ngOnInit(): void {
    this.refresh(true);
    // The room is a live view: poll the server rather than trusting the client clock.
    this.poll = setInterval(() => this.refresh(false), 2000);
    this.tick = setInterval(() => {
      this.nowTick.set(Date.now());
      const a = this.a();
      if (a && a.status === 'LIVE') this.remaining.set(Math.max(0, Math.round((new Date(a.closesAt).getTime() - this.serverNow()) / 1000)));
    }, 1000);
  }
  ngOnDestroy(): void { if (this.poll) clearInterval(this.poll); if (this.tick) clearInterval(this.tick); }

  private stopPolling(): void { if (this.poll) { clearInterval(this.poll); this.poll = undefined; } }

  refresh(first: boolean): void {
    this.api.auctionState(this.id()).subscribe({
      next: (s) => {
        const prev = this.a();
        this.a.set(s);
        this.nowTick.set(Date.now());
        this.serverOffsetMs.set(Date.now() - new Date(s.serverTime).getTime());
        this.remaining.set(s.secondsRemaining);
        // Announce the transition out of LIVE once, then stop polling a finished auction.
        if (prev && prev.status === 'LIVE' && s.status !== 'LIVE') {
          this.ok.set(s.leader?.isYou ? 'The auction closed and you won.' : 'The auction has closed.');
        }
        if (s.status !== 'LIVE' && s.status !== 'SCHEDULED') this.stopPolling();
        if (first) this.loading.set(false);
      },
      error: (e) => { if (first) { this.error.set(errMsg(e)); this.loading.set(false); } },
    });
  }

  durationLabel(a: AuctionStateDto): string {
    const mins = Math.max(1, Math.round((new Date(a.closesAt).getTime() - new Date(a.scheduledStartAt).getTime()) / 60000));
    return mins >= 60 ? `${Math.round((mins / 60) * 10) / 10} h` : `${mins} min`;
  }

  bid(): void {
    const a = this.a();
    if (!a) return;
    this.busy.set(true); this.error.set(null); this.ok.set(null);
    this.api.placeBid(this.id()).subscribe({
      next: (s) => {
        this.a.set(s);
        this.nowTick.set(Date.now());
        this.serverOffsetMs.set(Date.now() - new Date(s.serverTime).getTime());
        this.remaining.set(s.secondsRemaining);
        this.busy.set(false);
        this.ok.set('Bid placed. You are now the leading bidder.');
      },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); this.refresh(false); },
    });
  }
}
