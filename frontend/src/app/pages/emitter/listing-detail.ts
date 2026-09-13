import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import { AwardOption, AwardSuggestionDto, ListingDto, ProposalDto } from '../../core/models';
import { StatusBadge, TierBadge } from '../../shared/badges';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-emitter-listing-detail',
  imports: [DatePipe, DecimalPipe, RouterLink, StatusBadge, TierBadge, LabelPipe, MoneyPipe, TonnesPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    @if (loading()) {<app-loading />}
    <app-alert [message]="error()" />
    <app-alert [message]="ok()" tone="success" />
    @if (l(); as l) {
      <app-page-header [title]="(l.mode | label) + ' listing · ' + l.passportCode" [subtitle]="(l.volumeTonnes | tonnes) + ' at ' + (l.basePricePerTonne | money) + '/t · min purity ' + l.minPurityPct + '% · closes ' + (l.closesAt | date:'medium')">
        <app-status-badge [value]="l.status" />
        @if (l.status === 'OPEN') {<button class="btn btn-danger btn-sm" (click)="cancel()" [disabled]="busy()">Cancel listing &amp; release volume</button>}
      </app-page-header>

      @if (l.status === 'AWARDED') {<div class="banner">Awarded. Each winning proposal became its own agreement, pending Verification Lab approval. Unawarded volume was released back to the passport.</div>}

      <div class="grid grid-3 mb">
        <div class="stat"><div class="label">Volume listed</div><div class="value">{{ l.volumeTonnes | tonnes }}</div><div class="sub">passport total {{ l.passportTotalVolume | tonnes }}</div></div>
        <div class="stat"><div class="label">Base price</div><div class="value">{{ l.basePricePerTonne | money }}</div><div class="sub">per tonne · proposals must meet or beat this</div></div>
        <div class="stat"><div class="label">Proposals</div><div class="value">{{ proposals().length }}</div><div class="sub">{{ l.deliveryWindowStart | date:'mediumDate' }} → {{ l.deliveryWindowEnd | date:'mediumDate' }}</div></div>
      </div>

      @if (l.deliveryMonths) {
        <div class="alert alert-info mb">Delivery schedule attached to this tender: <strong>{{ l.monthlyTonnes | tonnes }} per month for {{ l.deliveryMonths }} months</strong>. Winning proposals inherit this schedule in their agreement.</div>
      }

      <!-- ===== Award shortcuts. The figures live in the proposals table below. ===== -->
      @if (sug(); as s) {
        <div class="card reco mb">
          <div class="reco-actions">
            <button class="btn btn-primary" (click)="useRecommendation()" [disabled]="busy() || l.status !== 'OPEN'">Select the recommended combination</button>
            @for (a of s.alternatives; track a.label) {
              <button class="btn btn-sm" (click)="useOption(a)" [disabled]="busy() || l.status !== 'OPEN'">Select: {{ a.label }}</button>
            }
            <button class="btn btn-sm" (click)="clearSelection()" [disabled]="busy() || !selected().size">Clear selection</button>
          </div>
        </div>
      }

      <!-- ===== Proposals with multi-select ===== -->
      <div class="card">
        <div class="reco-head">
          <h3>Proposals <span class="muted small">— money on the left, reliability on the right; accept as many as fit</span></h3>
          @if (l.status === 'OPEN' && proposals().length) {
            <div class="sel-summary" [class.over]="overCapacity()">
              <strong>{{ selectedTonnes() | tonnes }}</strong> of {{ l.volumeTonnes | tonnes }} selected
              · <strong>{{ selectedRevenue() | money }}</strong>
              @if (overCapacity()) {<span class="neg"> · exceeds the listed volume by {{ selectedTonnes() - l.volumeTonnes | number:'1.0-1' }} t</span>}
              @else if (selected().size) {<span class="muted"> · {{ l.volumeTonnes - selectedTonnes() | number:'1.0-1' }} t would return to free stock</span>}
            </div>
          }
        </div>
        @if (!proposals().length) {<app-empty-state message="No proposals yet." />}
        @else {
          <div class="table-wrap"><table class="table">
            <thead><tr>
              @if (l.status === 'OPEN') {<th style="width:2.2rem"></th>}
              <th>Utilizer</th><th>Tier</th><th class="r">Quantity</th><th class="r">Price / t</th><th class="r">Revenue</th>
              <th class="r">Purity req.</th><th class="r">Duration</th><th>Escrow</th><th>Status</th>
            </tr></thead>
            <tbody>@for (p of proposals(); track p.id) {
              <tr [class.highlight]="isRecommended(p.id)" [class.picked]="selected().has(p.id)">
                @if (l.status === 'OPEN') {
                  <td>@if (p.status === 'SUBMITTED') {<input type="checkbox" [checked]="selected().has(p.id)" (change)="toggleSelect(p.id)" [attr.aria-label]="'Select ' + p.utilizerName" />}</td>
                }
                <td>{{ p.utilizerName }}
                  <div class="muted small">{{ p.deliveryRequirement }}</div>
                  @if (p.otherRequirements) {<div class="muted small">{{ p.otherRequirements }}</div>}
                  @if (isRecommended(p.id)) {<span class="badge status-success">in best combination</span>}
                </td>
                <td><app-tier-badge [tier]="p.utilizerTier" /></td>
                <td class="r">{{ p.quantityTonnes | tonnes }}</td>
                <td class="r">{{ p.offeredPricePerTonne | money }}</td>
                <td class="r"><strong>{{ revenueOf(p) | money }}</strong></td>
                <td class="r">{{ p.requiredPurityPct }}%</td>
                <td class="r">{{ p.durationMonths }} mo</td>
                <td>{{ p.acceptsEscrow ? 'Yes' : 'No' }}</td>
                <td><app-status-badge [value]="p.status" /></td>
              </tr>
            }</tbody>
          </table></div>

          @if (l.status === 'OPEN') {
            <div class="form-actions mt">
              @if (overCapacity()) {<span class="muted small">Deselect something — the selection is larger than the volume you listed.</span>}
              @else if (!selected().size) {<span class="muted small">Tick one or more proposals to award.</span>}
              <button class="btn btn-primary" (click)="award()" [disabled]="busy() || !selected().size || overCapacity()">
                Award {{ selected().size }} {{ selected().size === 1 ? 'proposal' : 'proposals' }} · {{ selectedRevenue() | money }}
              </button>
            </div>
          }
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
  sug = signal<AwardSuggestionDto | null>(null);
  selected = signal<Set<string>>(new Set());
  loading = signal(true);
  busy = signal(false);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);

  selectedTonnes = computed(() => this.proposals().filter((p) => this.selected().has(p.id)).reduce((t, p) => t + p.quantityTonnes, 0));
  selectedRevenue = computed(() => this.proposals().filter((p) => this.selected().has(p.id)).reduce((t, p) => t + p.quantityTonnes * p.offeredPricePerTonne, 0));
  overCapacity = computed(() => { const l = this.l(); return !!l && this.selectedTonnes() > l.volumeTonnes + 1e-6; });

  ngOnInit(): void { this.load(); }

  load(): void {
    forkJoin({
      l: this.api.listing(this.id()),
      p: this.api.listingProposals(this.id()),
      s: this.api.awardSuggestion(this.id()).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ l, p, s }) => {
        this.l.set(l);
        this.proposals.set([...p].sort((a, b) => b.quantityTonnes * b.offeredPricePerTonne - a.quantityTonnes * a.offeredPricePerTonne));
        this.sug.set(s);
        this.loading.set(false);
      },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }

  revenueOf(p: ProposalDto): number { return p.quantityTonnes * p.offeredPricePerTonne; }
  isRecommended(id: string): boolean { return !!this.sug()?.recommended?.proposalIds?.includes(id); }
  toggleSelect(id: string): void {
    this.selected.update((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  useRecommendation(): void { const s = this.sug(); if (s) this.selected.set(new Set(s.recommended.proposalIds)); }
  useOption(o: AwardOption): void { this.selected.set(new Set(o.proposalIds)); }
  clearSelection(): void { this.selected.set(new Set()); }

  award(): void {
    const ids = [...this.selected()];
    const winners = this.proposals().filter((p) => this.selected().has(p.id));
    const names = winners.map((w) => `${w.utilizerName} (${w.quantityTonnes} t)`).join(', ');
    const l = this.l();
    const leftover = l ? l.volumeTonnes - this.selectedTonnes() : 0;
    if (!confirm(`Award to ${names}?\n\nTotal ${this.selectedRevenue().toLocaleString('en-IN')} rupees.${leftover > 0 ? `\n${leftover} t returns to free stock.` : ''}\nEvery other proposal is rejected and each sale goes to the lab for approval.`)) return;
    this.busy.set(true); this.error.set(null);
    this.api.award(this.id(), ids).subscribe({
      next: (agreements) => {
        this.busy.set(false);
        this.ok.set(`Awarded. ${agreements.length} agreement${agreements.length === 1 ? '' : 's'} created, pending lab approval.`);
        if (agreements.length === 1) this.router.navigate(['/agreements', agreements[0].id]);
        else { this.selected.set(new Set()); this.load(); }
      },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }

  cancel(): void {
    if (!confirm('Cancel this listing? Locked volume is released to the passport and open proposals are rejected.')) return;
    this.busy.set(true); this.error.set(null);
    this.api.cancelListing(this.id()).subscribe({ next: () => { this.busy.set(false); this.ok.set('Listing cancelled.'); this.load(); }, error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); } });
  }
}
