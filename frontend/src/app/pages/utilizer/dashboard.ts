import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AgreementDto, ListingDto, NotificationDto, ProposalDto, TrustDto } from '../../core/models';
import { StatusBadge, TierBadge } from '../../shared/badges';
import { MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-utilizer-dashboard',
  imports: [RouterLink, StatusBadge, TierBadge, MoneyPipe, TonnesPipe, Alert, Loading, PageHeader],
  template: `
    <app-page-header title="Utilizer dashboard" subtitle="Discover verified CO₂ supply, estimate full delivered cost, and respond to tenders, auctions or contracts.">
      <a class="btn btn-primary" routerLink="/utilizer/marketplace">Browse marketplace</a>
    </app-page-header>
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else {
      <div class="grid grid-4 mb">
        <div class="stat"><div class="label">Open supply</div><div class="value">{{ openListings().length }}</div><div class="sub">{{ openVolume() | tonnes }} listed right now</div></div>
        <div class="stat"><div class="label">My proposals</div><div class="value">{{ liveProposals().length }}</div><div class="sub">awaiting emitter decision</div></div>
        <div class="stat"><div class="label">Active agreements</div><div class="value">{{ active().length }}</div><div class="sub">{{ activeVolume() | tonnes }} under contract</div></div>
        <div class="stat"><div class="label">Trust tier</div><div class="value" style="font-size:1.2rem"><app-tier-badge [tier]="trust()?.tier" /></div><div class="sub"><a routerLink="/utilizer/trust">how to improve</a></div></div>
      </div>
      @if (shortfalls().length) {
        <div class="alert alert-warn"><strong>Forecast shortfall alert:</strong> {{ shortfalls()[0].message }} <a routerLink="/notifications">view all</a></div>
      }
      <div class="grid grid-2">
        <div class="card">
          <h3>Newest supply</h3>
          @for (l of openListings().slice(0, 6); track l.id) {
            <div class="row between" style="padding:0.4rem 0;border-bottom:1px solid var(--border)">
              <span><app-status-badge [value]="l.mode" /> {{ l.volumeTonnes | tonnes }} · {{ l.concentrationPct }}% · {{ l.city }}, {{ l.state }}</span>
              <a [routerLink]="['/utilizer/listings', l.id]">{{ l.basePricePerTonne | money }}/t ›</a>
            </div>
          } @empty {<p class="muted">No open listings.</p>}
        </div>
        <div class="card">
          <h3>My agreements</h3>
          @for (a of agreements().slice(0, 6); track a.id) {
            <div class="row between" style="padding:0.4rem 0;border-bottom:1px solid var(--border)">
              <span><app-status-badge [value]="a.status" /> {{ a.emitterName }} · {{ a.volumeTonnes | tonnes }}</span>
              <a [routerLink]="['/agreements', a.id]">open ›</a>
            </div>
          } @empty {<p class="muted">No agreements yet.</p>}
        </div>
      </div>
    }`,
})
export class UtilizerDashboard {
  private api = inject(ApiService);
  listings = signal<ListingDto[]>([]);
  proposals = signal<ProposalDto[]>([]);
  agreements = signal<AgreementDto[]>([]);
  notifs = signal<NotificationDto[]>([]);
  trust = signal<TrustDto | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  openListings = computed(() => this.listings().filter((l) => l.status === 'OPEN'));
  openVolume = computed(() => this.openListings().reduce((s, l) => s + l.volumeTonnes, 0));
  liveProposals = computed(() => this.proposals().filter((p) => p.status === 'SUBMITTED'));
  active = computed(() => this.agreements().filter((a) => a.status === 'ACTIVE'));
  activeVolume = computed(() => this.active().reduce((s, a) => s + a.volumeTonnes, 0));
  shortfalls = computed(() => this.notifs().filter((n) => n.type === 'FORECAST_SHORTFALL' && !n.read));

  constructor() {
    forkJoin({ l: this.api.listings({ status: 'OPEN' }), p: this.api.myProposals(), a: this.api.agreements(), t: this.api.myTrust(), n: this.api.notifications() }).subscribe({
      next: ({ l, p, a, t, n }) => { this.listings.set(l); this.proposals.set(p); this.agreements.set(a); this.trust.set(t); this.notifs.set(n); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
