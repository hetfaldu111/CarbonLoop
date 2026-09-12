import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { INDIAN_STATES, ListingDto } from '../../core/models';
import { StatusBadge, TierBadge } from '../../shared/badges';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-marketplace',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, StatusBadge, TierBadge, LabelPipe, MoneyPipe, TonnesPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="Marketplace" subtitle="Verified CO₂ supply. Emitter identities are hidden until you submit a proposal — only the fields you need to decide are public.">
      <select [(ngModel)]="mode" (ngModelChange)="load()" style="width:auto"><option value="">All modes</option><option value="TENDER">Tender</option><option value="AUCTION">Auction</option><option value="CONTRACT">Contract</option></select>
      <select [(ngModel)]="state" (ngModelChange)="load()" style="width:auto"><option value="">All states</option>@for (s of states; track s) {<option [value]="s">{{ s }}</option>}</select>
      <input type="number" step="0.1" [(ngModel)]="minPurity" (change)="load()" placeholder="Min purity %" style="width:130px" />
    </app-page-header>
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!rows().length) {<app-empty-state message="No open listings match your filters." icon="▣" />}
    @else {
      <div class="grid grid-auto">
        @for (l of rows(); track l.id) {
          <div class="card listing-card">
            <div class="row between">
              <span class="row" style="gap:.35rem"><app-status-badge [value]="l.mode" />@if (l.mode === 'AUCTION') {<app-status-badge [value]="l.status" />}</span>
              <span class="muted small">@if (l.mode === 'AUCTION' && l.scheduledStartAt) {opens {{ l.scheduledStartAt | date:'short' }}} @else {closes {{ l.closesAt | date:'mediumDate' }}}</span>
            </div>
            <div class="price">{{ (l.mode === 'AUCTION' ? (l.currentPricePerTonne ?? l.basePricePerTonne) : l.basePricePerTonne) | money }} <span class="muted small">/ t @if (l.mode === 'AUCTION') {{{ l.bidCount ? 'current · ' + l.bidCount + ' bids' : 'opening' }}}</span></div>
            <div class="meta">
              <span><strong>{{ l.volumeTonnes | tonnes }}</strong> listed</span>
              <span>{{ l.concentrationPct | number:'1.1-1' }}% CO₂ (min {{ l.minPurityPct }}%)</span>
              <span>{{ l.physicalState | label }}</span>
              <span>{{ l.captureTechnology }}</span>
              <span>{{ l.carbonOrigin | label }}</span>
              <span>{{ l.city }}, {{ l.state }}</span>
              @if (l.pipelineConnected) {<span>pipeline ✓</span>}
            </div>
            <div class="row between">
              <span class="small">{{ l.emitterName || 'Emitter hidden' }} <app-tier-badge [tier]="l.emitterTier" /></span>
              <span class="muted small">{{ l.proposalCount }} proposal{{ l.proposalCount === 1 ? '' : 's' }}</span>
            </div>
            @if (l.mode === 'AUCTION') {
              <a class="btn btn-primary btn-sm" [routerLink]="['/utilizer/auctions', l.id]">{{ l.status === 'LIVE' ? 'Join the live auction' : 'View the auction' }}</a>
            } @else {
              <a class="btn btn-primary btn-sm" [routerLink]="['/utilizer/listings', l.id]">Estimate cost &amp; respond</a>
            }
          </div>
        }
      </div>
    }`,
})
export class Marketplace {
  private api = inject(ApiService);
  states = INDIAN_STATES;
  rows = signal<ListingDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  mode = ''; state = ''; minPurity: number | null = null;
  constructor() { this.load(); }
  load(): void {
    this.loading.set(true);
    this.api.listings({ status: 'OPEN', mode: this.mode || undefined, state: this.state || undefined, minPurity: this.minPurity ?? undefined }).subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
