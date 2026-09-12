import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ImpactDto, PublicListingDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Loading, Alert } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, DecimalPipe, DatePipe, StatusBadge, LabelPipe, MoneyPipe, TonnesPipe, Loading, Alert],
  template: `
    <section class="hero">
      <div class="container">
        <span class="badge status-tender">Circular Carbon Ecosystem · Hackout '26</span>
        <h1>Turn captured CO₂ from a cost center into a tradeable resource.</h1>
        <p class="lead">Cement, steel and power plants list captured CO₂ with a verified <strong>CO₂ Passport</strong>. Fuel synthesis, building-material, greenhouse and algae producers discover it, estimate the full delivered cost, and buy through tenders, auctions or long-term contracts — with logistics, lab verification and chain-of-custody built in.</p>
        <div class="row">
          <a class="btn btn-primary btn-lg" routerLink="/register">Register your company</a>
          <a class="btn btn-lg" routerLink="/login">Log in</a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <h2>Impact counter <span class="muted small">— live, anonymized, platform-wide</span></h2>
        @if (loading()) {<app-loading />}
        <app-alert [message]="error()" />
        @if (impact(); as im) {
          <div class="grid grid-4">
            <div class="stat big"><div class="label">Total CO₂ diverted</div><div class="value">{{ im.totalCo2DivertedTonnes | number:'1.0-0' }} t</div><div class="sub">delivered to productive use</div></div>
            <div class="stat big"><div class="label">Tonnes under contract</div><div class="value">{{ im.tonnesUnderContract | number:'1.0-0' }} t</div><div class="sub">active agreements</div></div>
            <div class="stat big"><div class="label">Active clusters</div><div class="value">{{ im.activeClusters }}</div><div class="sub">emitter–utilizer regions</div></div>
            <div class="stat big"><div class="label">Verified passports</div><div class="value">{{ im.verifiedPassports }}</div><div class="sub">{{ im.activeListings }} open listings · {{ im.completedAgreements }} completed deals</div></div>
          </div>
          <div class="grid grid-2 mt">
            <div class="card">
              <h3>By region</h3>
              @for (r of im.byRegion; track r.region) {
                <div class="hbar"><span>{{ r.region }}</span><div class="bar"><div [style.width.%]="pct(r.tonnes, maxRegion())"></div></div><span class="r">{{ r.tonnes | number:'1.0-0' }} t</span></div>
              } @empty {<p class="muted">No regional data yet.</p>}
            </div>
            <div class="card">
              <h3>By sector</h3>
              @for (s of im.bySector; track s.sector) {
                <div class="hbar"><span>{{ s.sector | label }}</span><div class="bar"><div class="alt" [style.width.%]="pct(s.tonnes, maxSector())"></div></div><span class="r">{{ s.tonnes | number:'1.0-0' }} t</span></div>
              } @empty {<p class="muted">No sector data yet.</p>}
            </div>
          </div>
        }
      </div>
    </section>

    <section class="section" style="background: var(--surface); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);">
      <div class="container">
        <h2>Open CO₂ supply right now <span class="muted small">— company identities are revealed only inside an active negotiation</span></h2>
        <div class="grid grid-auto">
          @for (l of listings(); track l.id) {
            <div class="card listing-card">
              <div class="row between"><app-status-badge [value]="l.mode" /><span class="muted small">closes {{ l.closesAt | date:'mediumDate' }}</span></div>
              <div class="price">{{ l.basePricePerTonne | money }} <span class="muted small">/ tonne</span></div>
              <div class="meta">
                <span>{{ l.volumeTonnes | tonnes }} available</span>
                <span>{{ l.concentrationPct | number:'1.1-1' }}% CO₂</span>
                <span>{{ l.physicalState | label }}</span>
                <span>{{ l.city }}, {{ l.state }}</span>
              </div>
              <a class="btn btn-sm" routerLink="/login">Log in to respond</a>
            </div>
          } @empty {<p class="muted">No open listings at the moment.</p>}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <h2>How matching works — deterministic, no AI, no ML, no blockchain</h2>
        <div class="grid grid-3">
          <div class="card">
            <h3>1. Passport, then verification</h3>
            <p>Every batch of CO₂ gets a Passport: source, capture technology, concentration, impurities (H₂O, O₂, NOₓ, SOₓ, H₂S, CO, N₂), state, pressure, meter ID and location. An independent lab issues the Certificate of Analysis before anything can be listed. COAs expire and must be re-tested.</p>
          </div>
          <div class="card">
            <h3>2. Three sale modes, one capacity ledger</h3>
            <p><strong>Tender</strong> for plannable wholesale demand, <strong>Auction</strong> for urgent spot lots, <strong>Negotiated contract</strong> for multi-month certainty (CBAM, green-steel timelines). Every tonne allocated is locked on the Passport inside a database transaction, so the same tonnes can never be sold twice.</p>
          </div>
          <div class="card">
            <h3>3. Explainable priority score</h3>
            <p>Buyers are ranked with a published weighted formula: trust tier, hidden reliability score, cancellation rate (heaviest penalty), offered price, volume fit, commitment length, escrow acceptance and distance. In tender mode trust outweighs price; in auction mode price weighs more. The emitter always makes the final call.</p>
          </div>
          <div class="card">
            <h3>4. Full delivered cost, layer by layer</h3>
            <p>Base CO₂ price + purification/conditioning (only if your spec exceeds the stream) + transport (pipeline / rail / truck by distance and volume) + lab verification + platform fee. Expected leakage and <em>net carbon benefit</em> are reported separately, never blended into price.</p>
          </div>
          <div class="card">
            <h3>5. Chain of custody</h3>
            <p>Tamper-evident numbered seals, signed meter readings and lab sampling at loading and at delivery. Weight, seal, purity and meter reconciliation automatically flags a shipment if anything drifts beyond tolerance.</p>
          </div>
          <div class="card">
            <h3>6. Policy grounding</h3>
            <p>India's ₹20,000 crore CCUS allocation (2026-27) targets power, steel, cement, refineries and chemicals; NITI Aayog's cluster-hub model names Gujarat and Odisha as pilots; the EU's CBAM entered its financial phase on 1 January 2026. The regulator view flags which companies and deals qualify.</p>
          </div>
        </div>
      </div>
    </section>`,
})
export class Landing {
  private api = inject(ApiService);
  impact = signal<ImpactDto | null>(null);
  listings = signal<PublicListingDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  maxRegion = computed(() => Math.max(1, ...(this.impact()?.byRegion.map((r) => r.tonnes) ?? [1])));
  maxSector = computed(() => Math.max(1, ...(this.impact()?.bySector.map((r) => r.tonnes) ?? [1])));

  constructor() {
    this.api.impact().subscribe({
      next: (i) => { this.impact.set(i); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
    this.api.publicListings().subscribe({ next: (l) => this.listings.set(l), error: () => {} });
  }
  pct(v: number, max: number): number { return max > 0 ? (v / max) * 100 : 0; }
}
