import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuctionBidDto, AuctionStateDto } from '../../core/models';
import { TierBadge } from '../../shared/badges';
import { MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

const HOW = [
  { step: '01', title: 'Schedule', desc: 'Set a date and time. Every verified utilizer is notified when the auction is published.' },
  { step: '02', title: 'Utilizers bid', desc: 'Each bid raises the price by exactly the increment you set. Nobody can bid against themselves.' },
  { step: '03', title: 'Live ladder', desc: 'You see the standing bid and full bid history in real time, with real company names.' },
  { step: '04', title: 'Bid locks', desc: 'When the clock stops the last bid wins automatically and becomes a binding agreement.' },
];

@Component({
  selector: 'app-emitter-auctions',
  imports: [FormsModule, RouterLink, TierBadge, MoneyPipe, TonnesPipe, Alert, EmptyState, Loading],
  template: `
    <div class="em-ac-header">
      <h1>Live Auctions</h1>
      <div class="em-ac-tools">
        <div class="em-search">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
            <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" />
          </svg>
          <input [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Search auctions…" aria-label="Search auctions" />
        </div>
        <a class="em-btn em-btn-green" routerLink="/emitter/auctions/new">+ Create Auction</a>
      </div>
    </div>
    <p class="em-ac-sub">Live tracking of every lot you put up. Bidder names are shown in full because you are the seller.</p>
    <app-alert [message]="error()" />

    @if (loading()) {<app-loading />}
    @else if (!rows().length) {<app-empty-state message="You have not scheduled any auctions yet." />}
    @else {
      @for (group of groups(); track group.key) {
        @if (group.rows.length) {
          <h3 class="section-title">{{ group.label }} @if (group.key === 'live') {<span class="live-dot"></span>}</h3>
          <div class="em-stack mb">
            @for (a of group.rows; track a.listingId) {
              <!-- one card shape for every auction, live or not -->
              <div class="em-ac" [class.done]="group.key === 'ended'">
                <div class="em-ac-head">
                  <div>
                    <div class="em-ac-tags">
                      <span class="badge status-auction">Auction</span>
                      <span class="em-mono">{{ a.passportCode }}</span>
                    </div>
                    <div class="em-ac-title">{{ a.volumeTonnes | tonnes }} lot · {{ a.concentrationPct }}% CO₂</div>
                    <div class="em-ac-meta">
                      <span>{{ a.volumeTonnes | tonnes }} listed</span><span>·</span>
                      <span>{{ a.concentrationPct }}% CO₂</span><span>·</span>
                      <span>Base {{ a.basePricePerTonne | money }}/t</span><span>·</span>
                      <span>Min raise {{ a.bidIncrement | money }}/t</span>
                    </div>
                  </div>
                  <div class="em-ac-timer">
                    <div class="em-mono-label">{{ timerLabel(a, group.key) }}</div>
                    <div class="em-ac-clock" [style.color]="timerColour(a, group.key)">{{ timerValue(a, group.key) }}</div>
                    @if (group.key === 'live' && a.secondsRemaining < 300) {<div class="em-ac-soon">⚡ Closing soon</div>}
                  </div>
                </div>

                <div class="em-ac-body">
                  <!-- left: the standing bid -->
                  <div class="em-ac-left">
                    <div class="em-mono-label">{{ group.key === 'ended' ? 'Final price' : 'Current highest bid' }}</div>
                    <div class="em-ac-price">{{ (a.currentPricePerTonne ?? a.basePricePerTonne) | money }}<span>/t</span></div>
                    <div class="em-ac-total">Total value: {{ (a.currentTotal ?? a.basePricePerTonne * a.volumeTonnes) | money }}</div>

                    @if (a.leader) {
                      <div class="em-ac-winner">
                        <span class="n">1</span>
                        <div>
                          <div class="em-strong">{{ a.leader.displayName }}</div>
                          <div class="w-meta">
                            <app-tier-badge [tier]="a.leader.tier" />
                            <span>raised +{{ raiseOf(a, 0) | money }}/t · {{ ago(a.bids[0].placedAt) }}</span>
                          </div>
                        </div>
                      </div>
                    } @else {
                      <div class="em-ac-nobids">{{ group.key === 'ended' ? 'Closed with no bids — the volume returned to free stock.' : 'No bids yet. The lot opens at ' + (a.basePricePerTonne | money) + '/t.' }}</div>
                    }

                    @if (group.key !== 'ended') {
                      <div class="em-ac-next">
                        <div class="l">Next bid will be at least</div>
                        <div class="v">{{ a.nextBidPricePerTonne | money }}/t</div>
                        <div class="s">(current + {{ a.bidIncrement | money }} min raise)</div>
                      </div>
                    }
                  </div>

                  <!-- right: the ranked bid ladder -->
                  <div class="em-ac-right">
                    <div class="em-mono-label">{{ ladderLabel(a) }}</div>
                    @if (a.bids.length) {
                      <div class="em-ladder">
                        @for (b of a.bids.slice(0, 3); track b.placedAt; let i = $index) {
                          <div class="em-bid" [class.top]="i === 0">
                            <span class="rank">{{ i + 1 }}</span>
                            <div class="who">
                              <div class="nm">{{ b.displayName }} <app-tier-badge [tier]="b.tier" /></div>
                              <div class="sub">+{{ raiseOf(a, i) | money }}/t raise · {{ ago(b.placedAt) }}</div>
                            </div>
                            <div class="amt">{{ b.amountPerTonne | money }}<span>/t</span></div>
                          </div>
                        }
                      </div>
                    } @else {<div class="em-empty"><span class="ico">◌</span>Nobody has bid yet.</div>}
                    <div class="em-ac-actions">
                      <a class="em-btn em-btn-out em-btn-sm" [routerLink]="['/emitter/auctions', a.listingId]">Open the room →</a>
                      @if (a.agreementId) {<a class="em-btn em-btn-out em-btn-sm" [routerLink]="['/agreements', a.agreementId]">Agreement</a>}
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      }

      <!-- how live auctions work, per the design -->
      <div class="em-card pad em-how">
        <div class="em-mono-label">How live auctions work</div>
        <div class="em-how-grid">
          @for (h of howItWorks; track h.step) {
            <div class="em-how-item">
              <span class="n">{{ h.step }}</span>
              <div>
                <div class="t">{{ h.title }}</div>
                <div class="d">{{ h.desc }}</div>
              </div>
            </div>
          }
        </div>
      </div>
    }`,
})
export class EmitterAuctions implements OnDestroy {
  howItWorks = HOW;
  private api = inject(ApiService);
  rows = signal<AuctionStateDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  search = signal('');
  private poll?: ReturnType<typeof setInterval>;

  /** Matches the design's search: passport code, status or lot size. */
  private match = (a: AuctionStateDto): boolean => {
    const q = this.search().trim().toLowerCase();
    if (!q) return true;
    return [a.passportCode, a.status, String(a.volumeTonnes), a.city, a.state]
      .some((v) => (v ?? '').toString().toLowerCase().includes(q));
  };

  /** Live, scheduled and closed all render through the same card. */
  groups = computed(() => [
    { key: 'live', label: 'Live now', rows: this.rows().filter((a) => a.status === 'LIVE' && this.match(a)) },
    { key: 'scheduled', label: 'Scheduled', rows: this.rows().filter((a) => a.status === 'SCHEDULED' && this.match(a)) },
    { key: 'ended', label: 'Closed', rows: this.rows().filter((a) => a.status !== 'LIVE' && a.status !== 'SCHEDULED' && this.match(a)) },
  ]);

  ngOnInit(): void { this.load(true); this.poll = setInterval(() => this.load(false), 3000); }
  ngOnDestroy(): void { if (this.poll) clearInterval(this.poll); }

  load(first: boolean): void {
    this.api.myAuctions().subscribe({
      next: (r) => { this.rows.set(r); if (first) this.loading.set(false); },
      error: (e) => { if (first) { this.error.set(errMsg(e)); this.loading.set(false); } },
    });
  }

  timerLabel(a: AuctionStateDto, key: string): string {
    return key === 'live' ? 'Time remaining' : key === 'scheduled' ? 'Opens in' : 'Auction closed';
  }
  timerValue(a: AuctionStateDto, key: string): string {
    if (key === 'ended') return 'LOCKED';
    const secs = key === 'scheduled' ? this.secondsUntil(a.scheduledStartAt) : a.secondsRemaining;
    return this.clock(secs);
  }
  /** Green with time in hand, amber under 15 minutes, red under 5 — as in the design. */
  timerColour(a: AuctionStateDto, key: string): string {
    if (key === 'ended') return 'rgba(13,35,24,0.3)';
    if (key === 'scheduled') return '#0d2318';
    const s = a.secondsRemaining ?? 0;
    return s < 300 ? '#ef4444' : s < 900 ? '#f59e0b' : '#22c55e';
  }
  private secondsUntil(iso: string): number {
    const t = new Date(iso).getTime();
    return isNaN(t) ? 0 : Math.max(0, Math.round((t - Date.now()) / 1000));
  }
  /** "11m 57s" / "2h 04m" / "45s", matching the design's timer. */
  clock(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
    if (s >= 60) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
    return `${s}s`;
  }

  ladderLabel(a: AuctionStateDto): string {
    const shown = Math.min(3, a.bids.length);
    if (!a.bids.length) return 'Bid history';
    return `Top ${shown} bid${shown === 1 ? '' : 's'} — ${a.bidCount} total`;
  }
  /** How much this bid raised the price: the gap to the bid beneath it, else the increment. */
  raiseOf(a: AuctionStateDto, i: number): number {
    const bids: AuctionBidDto[] = a.bids;
    const cur = bids[i];
    if (!cur) return a.bidIncrement;
    const below = bids[i + 1];
    return below ? Math.max(0, cur.amountPerTonne - below.amountPerTonne) : Math.max(0, cur.amountPerTonne - a.basePricePerTonne) || a.bidIncrement;
  }
  /** Relative time, as the design shows it ("2 min ago"). */
  ago(iso: string): string {
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
  }
}
