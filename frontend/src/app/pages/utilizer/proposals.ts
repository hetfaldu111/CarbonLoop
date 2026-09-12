import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ProposalDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-my-proposals',
  imports: [DatePipe, RouterLink, StatusBadge, MoneyPipe, TonnesPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="My proposals & bids" subtitle="Every proposal and auction bid you have submitted, and where each one stands." />
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!rows().length) {<app-empty-state message="You haven't responded to any listing yet." icon="✉" />}
    @else {
      <div class="card tight table-wrap"><table class="table">
        <thead><tr><th>Listing</th><th>Mode</th><th class="r">Quantity</th><th class="r">Price / t</th><th class="r">Duration</th><th>Escrow</th><th>Status</th><th>Submitted</th><th></th></tr></thead>
        <tbody>@for (p of rows(); track p.id) {
          <tr>
            <td><a [routerLink]="['/utilizer/listings', p.listingId]">open listing</a></td>
            <td><app-status-badge [value]="p.listingMode" /></td>
            <td class="r">{{ p.quantityTonnes | tonnes }}</td>
            <td class="r">{{ p.offeredPricePerTonne | money }}</td>
            <td class="r">{{ p.durationMonths }} mo</td>
            <td>{{ p.acceptsEscrow ? 'Yes' : 'No' }}</td>
            <td><app-status-badge [value]="p.status" /></td>
            <td class="small">{{ p.createdAt | date:'mediumDate' }}</td>
            <td class="nowrap">@if (p.status === 'SUBMITTED') {<button class="btn btn-sm btn-danger" (click)="withdraw(p)" [disabled]="busy()">Withdraw</button>}</td>
          </tr>
        }</tbody>
      </table></div>
    }`,
})
export class MyProposals {
  private api = inject(ApiService);
  rows = signal<ProposalDto[]>([]);
  loading = signal(true);
  busy = signal(false);
  error = signal<string | null>(null);
  constructor() {
    this.api.myProposals().subscribe({ next: (r) => { this.rows.set(r); this.loading.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); } });
  }
  withdraw(p: ProposalDto): void {
    this.busy.set(true);
    this.api.withdrawProposal(p.id).subscribe({ next: (pr) => { this.rows.update((rs) => rs.map((x) => (x.id === pr.id ? pr : x))); this.busy.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); } });
  }
}
