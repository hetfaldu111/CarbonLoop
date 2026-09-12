import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import { AgreementDto, AllocationDto, ListingDto, NotificationDto, PassportDto, ShipmentDto, TrustDto } from '../../core/models';
import { TonnesPipe, MoneyPipe, LabelPipe } from '../../shared/pipes';
import { Alert, Loading } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

/** The six stages of the loop shown on the carbon-flow card. */
const FLOW = [
  { n: '01', label: 'CAPTURE' },
  { n: '02', label: 'VERIFY' },
  { n: '03', label: 'PASSPORT' },
  { n: '04', label: 'MATCH' },
  { n: '05', label: 'TRANSPORT' },
  { n: '06', label: 'UTILIZE' },
];

@Component({
  selector: 'app-emitter-dashboard',
  imports: [RouterLink, DecimalPipe, TonnesPipe, MoneyPipe, LabelPipe, Alert, Loading],
  template: `
    <div class="em-page">
      <app-alert [message]="error()" />
      @if (loading()) {<app-loading />}
      @else {

        <!-- ===== hero ===== -->
        <section class="em-card-dark em-hero">
          <div class="em-hero-grid"></div>
          <div class="em-hero-in">
            <h1>Manage your <em>captured carbon</em><br />allocate, trade, deliver.</h1>
            <p>Capacity allocation across all your CO₂ Passports — what is in tender, in auction, locked under contract, and still free.</p>
            <div class="em-hero-cta">
              <a class="em-btn em-btn-green" routerLink="/emitter/passports/new">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 2v10M2 7h10" /></svg>
                New CO₂ Stream
              </a>
              <a class="em-btn em-btn-out" routerLink="/emitter/listings">View Listings</a>
            </div>
          </div>
        </section>

        <!-- ===== KPI row ===== -->
        <section class="em-grid em-grid-4">
          <div class="em-kpi">
            <div class="em-kpi-top"><span class="em-mono-label">Passports</span><span class="em-ico-circle">▤</span></div>
            <div class="em-kpi-value">{{ passports().length }}</div>
            <div class="em-kpi-sub">{{ verifiedCount() }} verified</div>
          </div>
          <div class="em-kpi">
            <div class="em-kpi-top"><span class="em-mono-label">Open listings</span><span class="em-ico-circle">▣</span></div>
            <div class="em-kpi-value">{{ openListings().length }}</div>
            <div class="em-kpi-sub">{{ pendingProposals() }} proposals awaiting your decision</div>
          </div>
          <div class="em-kpi">
            <div class="em-kpi-top"><span class="em-mono-label">Active agreements</span><span class="em-ico-circle">✎</span></div>
            <div class="em-kpi-value">{{ activeAgreements().length }}</div>
            <div class="em-kpi-sub">{{ pendingAgreements() }} pending lab approval</div>
          </div>
          <div class="em-kpi">
            <div class="em-kpi-top"><span class="em-mono-label">Remaining stock</span><span class="em-ico-circle">◷</span></div>
            <div class="em-kpi-value">{{ freeTotal() | number:'1.0-0' }} <span style="font-size:20px">t</span></div>
            <div class="em-kpi-sub">free across all passports</div>
          </div>
        </section>

        <!-- ===== capacity allocation ===== -->
        <section class="em-card pad">
          <div class="em-head" style="margin-bottom:18px">
            <div>
              <h3 style="font-family:'Outfit',sans-serif;font-size:17px;font-weight:700;margin:0">Capacity allocation</h3>
              <p class="em-body" style="margin:2px 0 0">Locked volume per passport across all sale modes</p>
            </div>
            <span class="em-spacer"></span>
            <a class="em-btn em-btn-out em-btn-sm" routerLink="/emitter/passports">Manage →</a>
          </div>
          @if (!allocations().length) {
            <div class="em-empty"><span class="ico">◌</span>No passports yet. Create a CO₂ stream to start listing.</div>
          }
          @for (al of allocations(); track al.passportId) {
            <div class="em-alloc">
              <div class="em-alloc-top">
                <a class="em-pid" [routerLink]="['/emitter/passports', al.passportId]">{{ al.passportCode }}</a>
                <span class="em-mono">{{ al.allocatedTonnes | tonnes }} of {{ al.totalVolumeTonnes | tonnes }} allocated</span>
              </div>
              <div class="em-bar">
                @if (al.allocatedTender > 0) {<span [style.width.%]="pct(al, al.allocatedTender)" style="background:#22c55e"></span>}
                @if (al.allocatedAuction > 0) {<span [style.width.%]="pct(al, al.allocatedAuction)" style="background:#f59e0b"></span>}
                @if (al.allocatedContract > 0) {<span [style.width.%]="pct(al, al.allocatedContract)" style="background:#8b5cf6"></span>}
                @if (al.freeTonnes > 0) {<span [style.width.%]="pct(al, al.freeTonnes)" style="background:rgba(13,35,24,0.1)"></span>}
              </div>
              <div class="em-legend">
                <span class="k"><i style="background:#22c55e"></i>Tender {{ al.allocatedTender | tonnes }} ({{ pct(al, al.allocatedTender) | number:'1.0-0' }}%)</span>
                <span class="k"><i style="background:#f59e0b"></i>Auction {{ al.allocatedAuction | tonnes }} ({{ pct(al, al.allocatedAuction) | number:'1.0-0' }}%)</span>
                <span class="k"><i style="background:#8b5cf6"></i>Contract {{ al.allocatedContract | tonnes }} ({{ pct(al, al.allocatedContract) | number:'1.0-0' }}%)</span>
                <span class="k"><i style="background:rgba(13,35,24,0.35)"></i>Free {{ al.freeTonnes | tonnes }} ({{ pct(al, al.freeTonnes) | number:'1.0-0' }}%)</span>
                <span class="em-total">Total {{ al.totalVolumeTonnes | tonnes }}</span>
              </div>
            </div>
          }
        </section>

        <!-- ===== two columns ===== -->
        <section class="em-grid em-grid-2">
          <div class="em-card">
            <div class="em-card-head">
              <h3>Open listings</h3>
              <span class="em-count">{{ openListings().length }} live</span>
            </div>
            @for (l of openListings(); track l.id) {
              <a class="em-list-row" [routerLink]="['/emitter/listings', l.id]">
                <span class="em-mode-pill" [style.background]="modeBg(l.mode)" [style.color]="modeCol(l.mode)">{{ l.mode | label }}</span>
                <span class="em-row-main">
                  <span class="em-pid">{{ l.passportCode }}</span>
                  <span class="em-body" style="display:block">{{ l.volumeTonnes | tonnes }} at {{ l.basePricePerTonne | money:0 }}/t</span>
                </span>
                <span class="em-link">{{ l.proposalCount || 0 }} proposal{{ l.proposalCount === 1 ? '' : 's' }} ›</span>
              </a>
            } @empty {<div class="em-empty"><span class="ico">◌</span>No open listings.</div>}
          </div>

          <div class="em-card">
            <div class="em-card-head">
              <h3>Recent agreements</h3>
              <span class="em-count">{{ agreements().length }} total</span>
            </div>
            @for (a of agreements().slice(0, 5); track a.id) {
              <a class="em-list-row" [routerLink]="['/agreements', a.id]">
                <span class="em-badge" [class]="'em-badge ' + badgeClass(a.status)">{{ a.status | label }}</span>
                <span class="em-row-main">
                  <span class="em-strong" style="display:block">{{ a.utilizerName || 'Counterparty' }}</span>
                  <span class="em-mono">{{ a.volumeTonnes | tonnes }} · {{ a.pricePerTonne | money:0 }}/t</span>
                </span>
                <span class="em-link">open ›</span>
              </a>
            } @empty {<div class="em-empty"><span class="ico">◌</span>No agreements yet.</div>}
          </div>
        </section>

        <!-- ===== proposals + flow ===== -->
        <section class="em-grid em-grid-2">
          <div class="em-card">
            <div class="em-card-head">
              <h3>Incoming proposals</h3>
              <span class="em-count">{{ pendingProposals() }} awaiting your decision</span>
            </div>
            @for (l of listingsWithProposals(); track l.id) {
              <a class="em-list-row" [routerLink]="['/emitter/listings', l.id]">
                <span class="em-row-main">
                  <span class="em-strong" style="display:block">{{ l.proposalCount }} on {{ l.mode | label }} · {{ l.volumeTonnes | tonnes }}</span>
                  <span class="em-mono">{{ l.passportCode }}</span>
                </span>
                <span class="em-link">Review ›</span>
              </a>
            } @empty {<div class="em-empty"><span class="ico">◌</span>No proposals waiting.</div>}
          </div>

          <div class="em-card-dark" style="padding:24px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
              <span class="em-live-dot"></span>
              <span style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.12em;color:#4ade80">CARBON FLOW · LIVE ROUTING</span>
            </div>
            <div class="em-flow-steps">
              @for (s of flow; track s.n; let i = $index) {
                <div class="em-flow-step" [class.on]="i < activeStages()">
                  <div class="em-flow-dot">{{ s.n }}</div>
                  <span class="em-flow-label">{{ s.label }}</span>
                </div>
              }
            </div>
            <div class="em-flow-stats">
              <div><div class="v">{{ listedTotal() | number:'1.0-0' }}<small>t</small></div><div class="l">CO₂ LISTED</div></div>
              <div><div class="v">{{ tradedTotal() | number:'1.0-0' }}<small>t</small></div><div class="l">CO₂ ROUTED</div></div>
              <div><div class="v">{{ passports().length }}</div><div class="l">PASSPORTS</div></div>
              <div><div class="v" style="font-size:16px">{{ trust()?.tier || '—' | label }}</div><div class="l">BADGE</div></div>
            </div>
          </div>
        </section>

        <!-- ===== shipments + alerts ===== -->
        <section class="em-grid em-grid-2">
          <div class="em-card">
            <div class="em-card-head">
              <h3>Shipments</h3>
              <a class="em-link" routerLink="/emitter/shipments">All ›</a>
            </div>
            @for (s of shipments().slice(0, 4); track s.id) {
              <a class="em-list-row" [routerLink]="['/shipments', s.id]">
                <span class="em-row-main">
                  <span class="em-strong" style="display:block">{{ s.utilizerName || 'Delivery' }}</span>
                  <span class="em-mono">{{ s.passportCode }} · {{ s.volumeTonnes | tonnes }} · {{ s.transportMode | label }}</span>
                </span>
                <span class="em-badge" [class]="'em-badge ' + badgeClass(s.status)">{{ s.status | label }}</span>
              </a>
            } @empty {<div class="em-empty"><span class="ico">◌</span>No shipments yet.</div>}
          </div>

          <div class="em-card">
            <div class="em-card-head">
              <h3>Alerts</h3>
              <span class="em-count">{{ alerts().length }} active</span>
            </div>
            @for (n of alerts(); track n.id) {
              <div class="em-alert-row">
                <span class="em-alert-ico" [class]="'em-alert-ico ' + toneOf(n.type)">{{ glyphOf(n.type) }}</span>
                <div style="flex:1;min-width:0">
                  <p>{{ n.title }}</p>
                  <div class="t">{{ n.message }}</div>
                </div>
              </div>
            } @empty {<div class="em-empty"><span class="ico">◌</span>Nothing needs your attention.</div>}
          </div>
        </section>
      }
    </div>`,
})
export class EmitterDashboard {
  private api = inject(ApiService);
  flow = FLOW;
  passports = signal<PassportDto[]>([]);
  allocations = signal<AllocationDto[]>([]);
  listings = signal<ListingDto[]>([]);
  agreements = signal<AgreementDto[]>([]);
  shipments = signal<ShipmentDto[]>([]);
  notifications = signal<NotificationDto[]>([]);
  trust = signal<TrustDto | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  verifiedCount = computed(() => this.passports().filter((p) => p.verificationStatus === 'VERIFIED').length);
  openListings = computed(() => this.listings().filter((l) => l.status === 'OPEN' || l.status === 'LIVE' || l.status === 'SCHEDULED'));
  listingsWithProposals = computed(() => this.openListings().filter((l) => (l.proposalCount || 0) > 0));
  pendingProposals = computed(() => this.openListings().reduce((s, l) => s + (l.proposalCount || 0), 0));
  activeAgreements = computed(() => this.agreements().filter((a) => a.status === 'ACTIVE'));
  pendingAgreements = computed(() => this.agreements().filter((a) => a.status === 'PENDING_VERIFICATION').length);
  freeTotal = computed(() => this.allocations().reduce((s, a) => s + a.freeTonnes, 0));
  listedTotal = computed(() => this.openListings().reduce((s, l) => s + l.volumeTonnes, 0));
  tradedTotal = computed(() => this.agreements().filter((a) => a.status === 'ACTIVE' || a.status === 'COMPLETED').reduce((s, a) => s + a.volumeTonnes, 0));
  alerts = computed(() => this.notifications().filter((n) => !n.read).slice(0, 4));
  /** Light the flow up to the furthest stage this emitter has actually reached. */
  activeStages = computed(() => {
    if (this.shipments().some((s) => s.status === 'DELIVERED')) return 6;
    if (this.shipments().length) return 5;
    if (this.agreements().length) return 4;
    if (this.openListings().length) return 4;
    if (this.verifiedCount() > 0) return 3;
    return this.passports().length ? 1 : 0;
  });

  pct(a: AllocationDto, v: number): number {
    return a.totalVolumeTonnes > 0 ? Math.max(0, Math.min(100, (v / a.totalVolumeTonnes) * 100)) : 0;
  }
  modeCol(m: string): string { return m === 'AUCTION' ? '#92400e' : m === 'CONTRACT' ? '#6d28d9' : '#15803d'; }
  modeBg(m: string): string { return m === 'AUCTION' ? '#fef3c7' : m === 'CONTRACT' ? '#ede9fe' : '#dcfce7'; }
  badgeClass(s: string): string {
    const k = (s || '').toLowerCase();
    if (k.includes('active') || k === 'open' || k === 'live' || k === 'delivered' || k === 'accepted') return 'active';
    if (k.includes('pending') || k === 'requested' || k === 'scheduled' || k === 'in_transit') return 'pending';
    if (k === 'completed' || k === 'awarded') return 'completed';
    if (k === 'flagged' || k === 'rejected') return 'rejected';
    return 'closed';
  }
  toneOf(t: string): string {
    const k = (t || '').toUpperCase();
    if (k.includes('FLAG') || k.includes('REJECT') || k.includes('CANCEL')) return 'error';
    if (k.includes('SHORTFALL') || k.includes('EXPIR') || k.includes('OUTBID')) return 'warn';
    if (k.includes('APPROV') || k.includes('AWARD') || k.includes('WON') || k.includes('VERIFI')) return 'success';
    return '';
  }
  glyphOf(t: string): string {
    const k = (t || '').toUpperCase();
    if (k.includes('FLAG') || k.includes('REJECT') || k.includes('CANCEL')) return '!';
    if (k.includes('SHORTFALL') || k.includes('EXPIR') || k.includes('OUTBID')) return '⚠';
    if (k.includes('APPROV') || k.includes('AWARD') || k.includes('WON') || k.includes('VERIFI')) return '✓';
    return '•';
  }

  constructor() {
    forkJoin({
      p: this.api.passports(),
      l: this.api.myListings(),
      a: this.api.agreements(),
      t: this.api.myTrust().pipe(catchError(() => of(null as unknown as TrustDto))),
      s: this.api.shipments().pipe(catchError(() => of([] as ShipmentDto[]))),
      n: this.api.notifications().pipe(catchError(() => of([] as NotificationDto[]))),
    }).subscribe({
      next: ({ p, l, a, t, s, n }) => {
        this.passports.set(p); this.listings.set(l); this.agreements.set(a);
        this.trust.set(t); this.shipments.set(s); this.notifications.set(n);
        this.loading.set(false);
        if (p.length) {
          forkJoin(p.map((x) => this.api.allocation(x.id))).subscribe({ next: (als) => this.allocations.set(als), error: () => {} });
        }
      },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
