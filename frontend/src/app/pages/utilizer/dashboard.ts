import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import { AgreementDto, ProposalDto, ShipmentDto } from '../../core/models';
import { Alert, Loading } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-utilizer-dashboard',
  imports: [RouterLink, Alert, Loading],
  template: `
    <div class="em-page">
      <app-alert [message]="error()" />
      @if (loading()) {<app-loading />}
      @else {

        <!-- ===== hero ===== -->
        <section class="em-card-dark em-hero wide">
          <div class="em-hero-grid"></div>
          <div class="em-hero-orb one"></div>
          <div class="em-hero-orb two"></div>
          <div class="em-hero-in">
            <h1>Source CO₂ smarter — <em>bid, propose,</em><br />receive, utilise.</h1>
            <p>Your central hub for browsing listings, tracking live auctions, managing proposals and monitoring inbound shipments.</p>
            <div class="em-hero-cta">
              <a class="em-btn em-btn-green" routerLink="/utilizer/marketplace">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 2v10M2 7h10" /></svg>
                Browse Marketplace
              </a>
              <a class="em-btn em-btn-out" routerLink="/utilizer/auctions">View Auctions</a>
            </div>
          </div>
        </section>

        <!-- ===== three figures ===== -->
        <section class="em-grid em-grid-3">
          <a class="em-kpi" routerLink="/utilizer/proposals">
            <div class="em-kpi-top"><span class="em-mono-label">Open proposals</span></div>
            <div class="em-kpi-value">{{ openProposals().length }}</div>
            <div class="em-kpi-sub">awaiting response</div>
          </a>
          <a class="em-kpi" routerLink="/utilizer/agreements">
            <div class="em-kpi-top"><span class="em-mono-label">Active agreements</span></div>
            <div class="em-kpi-value">{{ activeAgreements().length }}</div>
            <div class="em-kpi-sub">{{ pendingLab() }} pending lab</div>
          </a>
          <a class="em-kpi" routerLink="/utilizer/shipments">
            <div class="em-kpi-top"><span class="em-mono-label">Inbound shipments</span></div>
            <div class="em-kpi-value">{{ inbound().length }}</div>
            <div class="em-kpi-sub">{{ inboundStage() }}</div>
          </a>
        </section>
      }
    </div>`,
})
export class UtilizerDashboard {
  private api = inject(ApiService);
  proposals = signal<ProposalDto[]>([]);
  agreements = signal<AgreementDto[]>([]);
  shipments = signal<ShipmentDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  openProposals = computed(() => this.proposals().filter((p) => p.status === 'SUBMITTED'));
  activeAgreements = computed(() => this.agreements().filter((a) => a.status === 'ACTIVE'));
  pendingLab = computed(() => this.agreements().filter((a) => a.status === 'PENDING_VERIFICATION').length);
  /** Anything on its way to us: requested, carrier assigned, or moving. */
  inbound = computed(() => this.shipments().filter((s) => s.status === 'REQUESTED' || s.status === 'ACCEPTED' || s.status === 'IN_TRANSIT'));

  /**
   * The reference shows an ETA here. Nothing in this system tracks a delivery estimate, so the
   * sub-line reports the furthest-along chain-of-custody stage instead, which is a real fact.
   */
  inboundStage = computed(() => {
    const s = this.inbound();
    if (!s.length) return 'none on the way';
    const moving = s.filter((x) => x.status === 'IN_TRANSIT').length;
    if (moving) return moving === 1 ? '1 in transit' : `${moving} in transit`;
    const assigned = s.filter((x) => x.status === 'ACCEPTED').length;
    if (assigned) return assigned === 1 ? 'carrier assigned' : `${assigned} carriers assigned`;
    return s.length === 1 ? 'awaiting a carrier' : 'awaiting carriers';
  });

  constructor() {
    forkJoin({
      p: this.api.myProposals().pipe(catchError(() => of([] as ProposalDto[]))),
      a: this.api.agreements().pipe(catchError(() => of([] as AgreementDto[]))),
      s: this.api.shipments().pipe(catchError(() => of([] as ShipmentDto[]))),
    }).subscribe({
      next: ({ p, a, s }) => {
        this.proposals.set(p); this.agreements.set(a); this.shipments.set(s);
        this.loading.set(false);
      },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
