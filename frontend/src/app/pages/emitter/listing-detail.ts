import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ListingDto, ProposalDto } from '../../core/models';
import { StatusBadge, TierBadge } from '../../shared/badges';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader, ScoreBreakdownView } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-emitter-listing-detail',
  imports: [DatePipe, DecimalPipe, RouterLink, StatusBadge, TierBadge, LabelPipe, MoneyPipe, TonnesPipe, Alert, EmptyState, Loading, PageHeader, ScoreBreakdownView],
  template: `
    @if (loading()) {<app-loading />}
    <app-alert [message]="error()" />
    <app-alert [message]="ok()" tone="success" />
    @if (l(); as l) {
      <app-page-header [title]="(l.mode | label) + ' listing · ' + l.passportCode" [subtitle]="(l.volumeTonnes | tonnes) + ' at ' + (l.basePricePerTonne | money) + '/t · min purity ' + l.minPurityPct + '% · closes ' + (l.closesAt | date:'medium')">
        <app-status-badge [value]="l.status" />
        @if (l.status === 'OPEN') {<button class="btn btn-danger btn-sm" (click)="cancel()" [disabled]="busy()">Cancel listing &amp; release volume</button>}
      </app-page-header>

      @if (l.status === 'AWARDED') {<div class="banner">Awarded. The agreement is pending Verification Lab approval; unused volume has been released back to the passport.</div>}

      <div class="grid grid-3 mb">
        <div class="stat"><div class="label">Volume listed</div><div class="value">{{ l.volumeTonnes | tonnes }}</div><div class="sub">passport total {{ l.passportTotalVolume | tonnes }}</div></div>
        <div class="stat"><div class="label">{{ l.mode === 'AUCTION' ? 'Starting / reserve' : 'Base price' }}</div><div class="value">{{ l.basePricePerTonne | money }}</div><div class="sub">@if (l.reservePricePerTonne) {reserve {{ l.reservePricePerTonne | money }}/t} @else {per tonne}</div></div>
        <div class="stat"><div class="label">Proposals</div><div class="value">{{ proposals().length }}</div><div class="sub">{{ l.deliveryWindowStart | date:'mediumDate' }} → {{ l.deliveryWindowEnd | date:'mediumDate' }}</div></div>
      </div>

      @if (recommended(); as r) {
        <div class="banner"><strong>System recommendation (rule-based):</strong> {{ r.recommendation || ('Recommended: ' + r.utilizerName + ' (score ' + (r.score | number:'1.1-1') + '). Final decision is yours.') }}</div>
      }

      <div class="card">
        <h3>Ranked {{ l.mode === 'AUCTION' ? 'bids' : 'proposals' }} <span class="muted small">— {{ l.mode === 'TENDER' ? 'trust and reliability outweigh raw price' : l.mode === 'AUCTION' ? 'price weighted heavily, trust still shown' : 'contract mode' }}</span></h3>
        @if (!proposals().length) {<app-empty-state message="No proposals yet." />}
        @else {
          <div class="table-wrap"><table class="table">
            <thead><tr><th>#</th><th>Utilizer</th><th>Tier</th><th class="r">Score</th><th class="r">Quantity</th><th class="r">Price / t</th><th class="r">Purity req.</th><th class="r">Duration</th><th>Escrow</th><th>Status</th><th></th></tr></thead>
            <tbody>@for (p of proposals(); track p.id; let i = $index) {
              <tr [class.highlight]="i === 0 && p.status === 'SUBMITTED'">
                <td><strong>{{ p.rank ?? i + 1 }}</strong></td>
                <td>{{ p.utilizerName }}<div class="muted small">{{ p.deliveryRequirement }}</div></td>
                <td><app-tier-badge [tier]="p.utilizerTier" /></td>
                <td class="r"><strong>{{ p.score | number:'1.1-1' }}</strong></td>
                <td class="r">{{ p.quantityTonnes | tonnes }}</td>
                <td class="r">{{ p.offeredPricePerTonne | money }}</td>
                <td class="r">{{ p.requiredPurityPct }}%</td>
                <td class="r">{{ p.durationMonths }} mo</td>
                <td>{{ p.acceptsEscrow ? 'Yes' : 'No' }}</td>
                <td><app-status-badge [value]="p.status" /></td>
                <td class="nowrap">
                  <button class="btn btn-sm" (click)="toggle(p.id)">{{ open() === p.id ? 'Hide' : 'Why?' }}</button>
                  @if (l.status === 'OPEN' && p.status === 'SUBMITTED') {<button class="btn btn-primary btn-sm" (click)="award(p)" [disabled]="busy()">Award</button>}
                </td>
              </tr>
              @if (open() === p.id) {
                <tr><td colspan="11">
                  <app-score-breakdown [b]="p.scoreBreakdown" />
                  @if (p.otherRequirements) {<p class="small mt"><strong>Other requirements:</strong> {{ p.otherRequirements }}</p>}
                </td></tr>
              }
            }</tbody>
          </table></div>
        }
      </div>

      <div class="card mt">
        <h3>Listing details</h3>
        <dl class="kv">
          <dt>Passport</dt><dd><a [routerLink]="['/emitter/passports', l.passportId]" class="mono">{{ l.passportCode }}</a> · {{ l.concentrationPct }}% · {{ l.physicalState | label }} · {{ l.captureTechnology }}</dd>
          <dt>Location</dt><dd>{{ l.city }}, {{ l.state }} {{ l.pipelineConnected ? '· pipeline-connected' : '' }}</dd>
          <dt>Description</dt><dd>{{ l.description || '—' }}</dd>
          <dt>Created</dt><dd>{{ l.createdAt | date:'medium' }}</dd>
        </dl>
      </div>
    }`,
})
export class EmitterListingDetail {
  id = input.required<string>();
  private api = inject(ApiService);
  private router = inject(Router);
  l = signal<ListingDto | null>(null);
  proposals = signal<ProposalDto[]>([]);
  loading = signal(true);
  busy = signal(false);
  open = signal<string | null>(null);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);
  recommended = computed(() => { const l = this.l(); if (l?.status !== 'OPEN') return null; return this.proposals().find((p) => p.status === 'SUBMITTED') ?? null; });

  ngOnInit(): void { this.load(); }
  load(): void {
    forkJoin({ l: this.api.listing(this.id()), p: this.api.listingProposals(this.id()) }).subscribe({
      next: ({ l, p }) => { this.l.set(l); this.proposals.set([...p].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || b.score - a.score)); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
  toggle(id: string): void { this.open.set(this.open() === id ? null : id); }
  award(p: ProposalDto): void {
    if (!confirm(`Award ${p.quantityTonnes} t to ${p.utilizerName} at ₹${p.offeredPricePerTonne}/t? Other proposals will be rejected and the sale sent to the lab for approval.`)) return;
    this.busy.set(true); this.error.set(null);
    this.api.award(this.id(), p.id).subscribe({
      next: (a) => { this.busy.set(false); this.ok.set('Awarded. Agreement created, pending lab approval.'); this.router.navigate(['/agreements', a.id]); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
  cancel(): void {
    if (!confirm('Cancel this listing? Locked volume is released to the passport and open proposals are rejected.')) return;
    this.busy.set(true); this.error.set(null);
    this.api.cancelListing(this.id()).subscribe({ next: () => { this.busy.set(false); this.ok.set('Listing cancelled.'); this.load(); }, error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); } });
  }
}
