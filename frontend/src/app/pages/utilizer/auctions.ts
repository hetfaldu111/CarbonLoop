import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuctionBidDto, AuctionFilter, AuctionStateDto } from '../../core/models';
import { TierBadge } from '../../shared/badges';
import { MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

const TABS: { key: AuctionFilter; label: string }[] = [
  { key: 'live', label: 'Live Now' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All' },
];

@Component({
  selector: 'app-utilizer-auctions',
  imports: [RouterLink, TierBadge, MoneyPipe, TonnesPipe, Alert, EmptyState, Loading],
  template: `
    <div class="em-page">

      <div class="em-head">
        <h1 class="em-h1">Auctions</h1>
        <span class="em-spacer"></span>
        <div class="ua-tabs" role="tablist">
          @for (t of tabs; track t.key) {
            <button role="tab" [attr.aria-selected]="tab() === t.key"
                    [class.active]="tab() === t.key" (click)="select(t.key)">{{ t.label }}</button>
          }
        </div>
      </div>

      <app-alert [message]="error()" />
      <app-alert [message]="ok()" tone="success" />

      @if (loading()) {<app-loading />}
      @else if (!rows().length) {<app-empty-state [message]="emptyMessage()" icon="⚡" />}
      @else {
        @for (a of rows(); track a.listingId) {
          <article class="ua-card" [class.done]="isOver(a)">

            <!-- ── header ───────────────────────────────────────────── -->
            <div class="ua-head">
              <div class="ua-head-main">
                <div class="ua-tags">
                  @if (a.status === 'LIVE') {
                    <span class="ua-state live"><i class="dot"></i>LIVE</span>
                  } @else if (a.status === 'SCHEDULED') {
                    <span class="ua-state sched">SCHEDULED</span>
                  } @else {
                    <span class="ua-state closed">CLOSED</span>
                  }
                  <span class="ua-ref">{{ ref(a) }}</span>
                  @if (a.status === 'LIVE' && a.youAreLeading) {<span class="ua-pill lead">✓ You're leading</span>}
                  @else if (isOver(a) && a.leader?.isYou) {<span class="ua-pill won">✓ You won this lot</span>}
                </div>
                <h3 class="ua-title">{{ title(a) }}</h3>
                <div class="ua-pid">{{ a.passportCode }}</div>
                <div class="ua-meta">
                  {{ a.volumeTonnes | tonnes }} · {{ a.concentrationPct }}% CO₂ · Base {{ a.basePricePerTonne | money }}/t · {{ a.city }}, {{ a.state }}
                </div>
              </div>
              <div class="ua-timer">
                <div class="ua-timer-l">{{ timerLabel(a) }}</div>
                <div class="ua-clock" [class.urgent]="a.status === 'LIVE' && left(a) <= 300">{{ timerValue(a) }}</div>
              </div>
            </div>

            <!-- ── body ─────────────────────────────────────────────── -->
            <div class="ua-body">

              <!-- left: the standing bid and the bid control -->
              <div class="ua-left">
                <div class="ua-l">{{ isOver(a) ? 'Final price' : 'Current highest bid' }}</div>
                <div class="ua-price">{{ (a.currentPricePerTonne ?? a.basePricePerTonne) | money }}<span>/t</span></div>
                <div class="ua-total">Total value: {{ (a.currentTotal ?? a.basePricePerTonne * a.volumeTonnes) | money }}</div>

                @if (a.leader) {
                  <div class="ua-leader">
                    <span class="n">1</span>
                    <div>
                      <div class="nm">{{ bidderLabel(a.leader.displayName, a.leader.isYou) }}</div>
                      <app-tier-badge [tier]="a.leader.tier" />
                    </div>
                  </div>
                } @else {
                  <div class="ua-nobids">
                    {{ isOver(a) ? 'Closed with no bids — the volume returned to the seller.' : 'No bids yet. Opens at ' + (a.basePricePerTonne | money) + '/t.' }}
                  </div>
                }

                @if (a.status === 'LIVE') {
                  <p class="ua-inc">Each bid adds {{ a.bidIncrement | money }}/t automatically</p>

                  @if (a.canBid) {
                    @if (!accepted().has(a.listingId)) {
                      <label class="ua-binding">
                        <input type="checkbox" (change)="accept(a.listingId)" />
                        <span>{{ a.bindingTerms }}</span>
                      </label>
                    }
                    <button class="ua-bid" (click)="bid(a)" [disabled]="busy() === a.listingId || !accepted().has(a.listingId)">
                      ⚡ Bid {{ a.nextBidPricePerTonne | money }}/t
                    </button>
                    @if (!accepted().has(a.listingId)) {
                      <p class="ua-note">Tick the commitment above to enable bidding.</p>
                    } @else {
                      <p class="ua-note">Binding. The server sets the amount — {{ nextTotal(a) | money }} for the whole lot.</p>
                    }
                  } @else {
                    <div class="ua-blocked">{{ a.blockedReason || 'You cannot bid in this auction.' }}</div>
                  }
                } @else if (a.status === 'SCHEDULED') {
                  <p class="ua-inc">Opens at {{ a.basePricePerTonne | money }}/t · each bid adds {{ a.bidIncrement | money }}/t</p>
                }

                <div class="ua-actions">
                  <a class="em-btn em-btn-out em-btn-sm" [routerLink]="['/utilizer/auctions', a.listingId]">Open the room →</a>
                  @if (a.agreementId) {<a class="em-btn em-btn-out em-btn-sm" [routerLink]="['/agreements', a.agreementId]">Agreement</a>}
                </div>
              </div>

              <!-- right: the ranked ladder -->
              <div class="ua-right">
                <div class="ua-l">{{ ladderLabel(a) }}</div>
                @if (a.bids.length) {
                  <div class="em-ladder">
                    @for (b of a.bids.slice(0, 3); track b.placedAt; let i = $index) {
                      <div class="em-bid" [class.top]="i === 0">
                        <span class="rank">{{ i + 1 }}</span>
                        <div class="who">
                          <div class="nm">{{ bidderLabel(b.displayName, b.isYou) }} <app-tier-badge [tier]="b.tier" /></div>
                          <div class="sub">{{ ago(b.placedAt) }}</div>
                        </div>
                        <div class="amt">{{ b.amountPerTonne | money }}<span>/t</span></div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="em-empty"><span class="ico">◌</span>Nobody has bid yet.</div>
                }
              </div>
            </div>
          </article>
        }
      }
    </div>`,
})
export class UtilizerAuctions implements OnDestroy {
  /** Reference leads with the stream's own description; fall back to the lot when absent. */
  title(a: AuctionStateDto): string {
    const parts = [a.captureTechnology, a.physicalState ? a.physicalState.charAt(0) + a.physicalState.slice(1).toLowerCase() : null]
      .filter(Boolean);
    return parts.length ? parts.join(' · ') : `${a.volumeTonnes} t lot · ${a.concentrationPct}% CO₂`;
  }

  private api = inject(ApiService);
  tabs = TABS;
  tab = signal<AuctionFilter>('live');
  rows = signal<AuctionStateDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);
  /** Listing ids whose binding terms this viewer has ticked in this session. */
  accepted = signal<Set<string>>(new Set());
  busy = signal<string | null>(null);

  private poll?: ReturnType<typeof setInterval>;
  private tick?: ReturnType<typeof setInterval>;
  /** Wall-clock reading taken at the moment of the last poll, so the countdown runs off the
   *  server's own `secondsRemaining` and only measures elapsed time locally. */
  private anchorMs = signal(Date.now());
  private serverOffsetMs = signal(0);
  private nowTick = signal(Date.now());

  emptyMessage = computed(() =>
    this.tab() === 'live' ? 'No auction is running right now. Check the upcoming tab.'
      : this.tab() === 'upcoming' ? 'Nothing is scheduled yet.'
        : 'No auctions to show.');

  ngOnInit(): void {
    this.load(true);
    this.poll = setInterval(() => this.load(false), 2000);
    this.tick = setInterval(() => this.nowTick.set(Date.now()), 1000);
  }
  ngOnDestroy(): void {
    if (this.poll) clearInterval(this.poll);
    if (this.tick) clearInterval(this.tick);
  }

  select(t: AuctionFilter): void {
    if (t === this.tab()) return;
    this.tab.set(t);
    this.loading.set(true);
    this.load(true);
  }

  load(first: boolean): void {
    this.api.auctions(this.tab()).subscribe({
      next: (r) => {
        this.rows.set(r);
        this.anchorMs.set(Date.now());
        this.nowTick.set(Date.now());
        if (r.length) this.serverOffsetMs.set(Date.now() - new Date(r[0].serverTime).getTime());
        if (first) this.loading.set(false);
      },
      error: (e) => { if (first) { this.error.set(errMsg(e)); this.loading.set(false); } },
    });
  }

  /** Seconds left on a live lot: the server's own figure, less the time elapsed since that poll. */
  left(a: AuctionStateDto): number {
    const elapsed = (this.nowTick() - this.anchorMs()) / 1000;
    return Math.max(0, Math.round(a.secondsRemaining - elapsed));
  }
  /** Seconds until a scheduled lot opens, measured against the server's clock, not this machine's. */
  private opensIn(a: AuctionStateDto): number {
    const serverNow = this.nowTick() - this.serverOffsetMs();
    const t = new Date(a.scheduledStartAt).getTime();
    return isNaN(t) ? 0 : Math.max(0, Math.round((t - serverNow) / 1000));
  }

  isOver(a: AuctionStateDto): boolean { return a.status !== 'LIVE' && a.status !== 'SCHEDULED'; }

  timerLabel(a: AuctionStateDto): string {
    return a.status === 'LIVE' ? 'Closes in' : a.status === 'SCHEDULED' ? 'Opens in' : 'Auction closed';
  }
  timerValue(a: AuctionStateDto): string {
    if (this.isOver(a)) return 'LOCKED';
    return this.clock(a.status === 'SCHEDULED' ? this.opensIn(a) : this.left(a));
  }
  /** "01m 41s" as the reference shows it, widening to "01h 23m" past the hour. */
  clock(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const p = (n: number) => String(n).padStart(2, '0');
    if (s >= 3600) return `${p(Math.floor(s / 3600))}h ${p(Math.floor((s % 3600) / 60))}m`;
    return `${p(Math.floor(s / 60))}m ${p(s % 60)}s`;
  }

  ladderLabel(a: AuctionStateDto): string {
    if (!a.bids.length) return 'Bid history';
    const shown = Math.min(3, a.bids.length);
    return `Top ${shown} bid${shown === 1 ? '' : 's'} — ${a.bidCount} total`;
  }

  /**
   * The API hands a utilizer a pseudonym ("Bidder #3"), never a rival's real name. Relabel it
   * to the reference's format from that string alone — the company identity is never consulted,
   * and anything that is not a pseudonym passes straight through.
   */
  bidderLabel(displayName: string, isYou: boolean): string {
    if (isYou) return 'You';
    const m = /^Bidder\s*#(\d+)$/i.exec((displayName ?? '').trim());
    return m ? `Utilizer · B-${m[1].padStart(3, '0')}` : (displayName ?? '');
  }

  /** Short reference taken from the END of the id: seeded ids all begin with the same zeros. */
  ref(a: AuctionStateDto): string { return 'AUC-' + a.listingId.replace(/-/g, '').slice(-6).toUpperCase(); }

  nextTotal(a: AuctionStateDto): number { return a.nextBidPricePerTonne * a.volumeTonnes; }

  ago(iso: string): string {
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    const s = Math.max(0, Math.round((this.nowTick() - t) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
  }

  accept(listingId: string): void {
    this.accepted.update((s) => { const n = new Set(s); n.has(listingId) ? n.delete(listingId) : n.add(listingId); return n; });
  }

  bid(a: AuctionStateDto): void {
    this.busy.set(a.listingId);
    this.error.set(null); this.ok.set(null);
    this.api.placeBid(a.listingId).subscribe({
      next: () => { this.busy.set(null); this.ok.set('Bid placed. You are now the leading bidder.'); this.load(false); },
      error: (e) => { this.busy.set(null); this.error.set(errMsg(e)); this.load(false); },
    });
  }
}
