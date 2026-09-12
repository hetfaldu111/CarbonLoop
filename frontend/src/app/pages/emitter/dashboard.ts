import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AgreementDto, AllocationDto, ListingDto, PassportDto, TrustDto } from '../../core/models';
import { StatusBadge, TierBadge } from '../../shared/badges';
import { TonnesPipe } from '../../shared/pipes';
import { Alert, AllocationBar, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-emitter-dashboard',
  imports: [RouterLink, StatusBadge, TierBadge, TonnesPipe, Alert, AllocationBar, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="Emitter dashboard" subtitle="Capacity allocation across all your CO₂ Passports — what is in tender, in auction, locked under contract, and still free.">
      <a class="btn" routerLink="/emitter/passports/new">New passport</a>
      <a class="btn btn-primary" routerLink="/emitter/listings/new">List CO₂</a>
    </app-page-header>
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else {
      <div class="grid grid-4 mb">
        <div class="stat"><div class="label">Passports</div><div class="value">{{ passports().length }}</div><div class="sub">{{ verifiedCount() }} verified</div></div>
        <div class="stat"><div class="label">Open listings</div><div class="value">{{ openListings().length }}</div><div class="sub">{{ pendingProposals() }} proposals awaiting your decision</div></div>
        <div class="stat"><div class="label">Active agreements</div><div class="value">{{ activeAgreements().length }}</div><div class="sub">{{ pendingAgreements() }} pending lab approval</div></div>
        <div class="stat"><div class="label">Trust</div><div class="value" style="font-size:1.2rem"><app-tier-badge [tier]="trust()?.tier" /></div><div class="sub">hidden score {{ trust()?.hiddenScore }}</div></div>
      </div>
      <div class="card">
        <h2>Capacity allocation</h2>
        @if (!allocations().length) {<app-empty-state message="No passports yet. Create one to start listing CO₂." />}
        @for (al of allocations(); track al.passportId) {
          <div class="mb">
            <div class="row between"><a [routerLink]="['/emitter/passports', al.passportId]"><strong class="mono">{{ al.passportCode }}</strong></a><span class="muted small">free {{ al.freeTonnes | tonnes }} of {{ al.totalVolumeTonnes | tonnes }}</span></div>
            <app-allocation-bar [a]="al" />
          </div>
        }
      </div>
      <div class="grid grid-2 mt">
        <div class="card">
          <h3>Open listings</h3>
          @for (l of openListings(); track l.id) {
            <div class="row between" style="padding:0.4rem 0;border-bottom:1px solid var(--border)">
              <span><app-status-badge [value]="l.mode" /> <span class="mono small">{{ l.passportCode }}</span> · {{ l.volumeTonnes | tonnes }}</span>
              <a [routerLink]="['/emitter/listings', l.id]">{{ l.proposalCount }} proposal{{ l.proposalCount === 1 ? '' : 's' }} ›</a>
            </div>
          } @empty {<p class="muted">No open listings.</p>}
        </div>
        <div class="card">
          <h3>Recent agreements</h3>
          @for (a of agreements().slice(0, 6); track a.id) {
            <div class="row between" style="padding:0.4rem 0;border-bottom:1px solid var(--border)">
              <span><app-status-badge [value]="a.status" /> {{ a.utilizerName }} · {{ a.volumeTonnes | tonnes }}</span>
              <a [routerLink]="['/agreements', a.id]">open ›</a>
            </div>
          } @empty {<p class="muted">No agreements yet.</p>}
        </div>
      </div>
    }`,
})
export class EmitterDashboard {
  private api = inject(ApiService);
  passports = signal<PassportDto[]>([]);
  allocations = signal<AllocationDto[]>([]);
  listings = signal<ListingDto[]>([]);
  agreements = signal<AgreementDto[]>([]);
  trust = signal<TrustDto | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  verifiedCount = computed(() => this.passports().filter((p) => p.verificationStatus === 'VERIFIED').length);
  openListings = computed(() => this.listings().filter((l) => l.status === 'OPEN'));
  pendingProposals = computed(() => this.openListings().reduce((s, l) => s + (l.proposalCount || 0), 0));
  activeAgreements = computed(() => this.agreements().filter((a) => a.status === 'ACTIVE'));
  pendingAgreements = computed(() => this.agreements().filter((a) => a.status === 'PENDING_VERIFICATION').length);

  constructor() {
    forkJoin({ p: this.api.passports(), l: this.api.myListings(), a: this.api.agreements(), t: this.api.myTrust() }).subscribe({
      next: ({ p, l, a, t }) => {
        this.passports.set(p); this.listings.set(l); this.agreements.set(a); this.trust.set(t); this.loading.set(false);
        if (p.length) forkJoin(p.map((x) => this.api.allocation(x.id))).subscribe({ next: (als) => this.allocations.set(als), error: () => {} });
      },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
