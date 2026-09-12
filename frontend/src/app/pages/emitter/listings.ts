import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ListingDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-emitter-listings',
  imports: [DatePipe, RouterLink, StatusBadge, MoneyPipe, TonnesPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="My listings" subtitle="You initiate every sale: publish part of a verified passport's volume as a Tender, an Auction, or open it for Contract negotiation.">
      <a class="btn btn-primary" routerLink="/emitter/listings/new">New listing</a>
    </app-page-header>
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!rows().length) {<app-empty-state message="No listings yet." icon="▣" />}
    @else {
      <div class="card tight table-wrap"><table class="table">
        <thead><tr><th>Passport</th><th>Mode</th><th class="r">Volume</th><th class="r">Base price / t</th><th class="r">Min purity</th><th>Delivery window</th><th>Closes</th><th class="r">Proposals</th><th>Status</th><th></th></tr></thead>
        <tbody>@for (l of rows(); track l.id) {
          <tr>
            <td class="mono">{{ l.passportCode }}</td>
            <td><app-status-badge [value]="l.mode" /></td>
            <td class="r">{{ l.volumeTonnes | tonnes }}</td>
            <td class="r">{{ l.basePricePerTonne | money }}@if (l.reservePricePerTonne) {<div class="muted small">reserve {{ l.reservePricePerTonne | money }}</div>}</td>
            <td class="r">{{ l.minPurityPct }}%</td>
            <td class="small">{{ l.deliveryWindowStart | date:'mediumDate' }} → {{ l.deliveryWindowEnd | date:'mediumDate' }}</td>
            <td class="small">{{ l.closesAt | date:'medium' }}</td>
            <td class="r">{{ l.proposalCount }}</td>
            <td><app-status-badge [value]="l.status" /></td>
            <td><a class="btn btn-sm" [routerLink]="['/emitter/listings', l.id]">Open</a></td>
          </tr>
        }</tbody>
      </table></div>
    }`,
})
export class EmitterListings {
  private api = inject(ApiService);
  rows = signal<ListingDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  constructor() {
    this.api.myListings().subscribe({ next: (r) => { this.rows.set(r); this.loading.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); } });
  }
}
