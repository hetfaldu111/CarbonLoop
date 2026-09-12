import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import { AgreementDto, AllocationDto, ListingDto, PassportDto } from '../../core/models';
import { Alert, Loading } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-emitter-dashboard',
  imports: [RouterLink, DecimalPipe, Alert, Loading],
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
      }
    </div>`,
})
export class EmitterDashboard {
  private api = inject(ApiService);
  passports = signal<PassportDto[]>([]);
  allocations = signal<AllocationDto[]>([]);
  listings = signal<ListingDto[]>([]);
  agreements = signal<AgreementDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  verifiedCount = computed(() => this.passports().filter((p) => p.verificationStatus === 'VERIFIED').length);
  openListings = computed(() => this.listings().filter((l) => l.status === 'OPEN' || l.status === 'LIVE' || l.status === 'SCHEDULED'));
  pendingProposals = computed(() => this.openListings().reduce((s, l) => s + (l.proposalCount || 0), 0));
  activeAgreements = computed(() => this.agreements().filter((a) => a.status === 'ACTIVE'));
  pendingAgreements = computed(() => this.agreements().filter((a) => a.status === 'PENDING_VERIFICATION').length);
  freeTotal = computed(() => this.allocations().reduce((s, a) => s + a.freeTonnes, 0));

  constructor() {
    forkJoin({
      p: this.api.passports(),
      l: this.api.myListings(),
      a: this.api.agreements().pipe(catchError(() => of([] as AgreementDto[]))),
    }).subscribe({
      next: ({ p, l, a }) => {
        this.passports.set(p); this.listings.set(l); this.agreements.set(a);
        this.loading.set(false);
        if (p.length) {
          forkJoin(p.map((x) => this.api.allocation(x.id))).subscribe({ next: (als) => this.allocations.set(als), error: () => {} });
        }
      },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
