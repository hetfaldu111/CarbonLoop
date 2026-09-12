import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AgreementDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-agreements-list',
  imports: [DatePipe, RouterLink, StatusBadge, MoneyPipe, TonnesPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="Agreements" subtitle="Awarded tenders, won auctions and signed contracts. Sales become ACTIVE only after lab approval.">
      <div class="tabs" style="margin:0;border:0">
        @for (t of tabs; track t) {<button [class.active]="tab() === t" (click)="tab.set(t)">{{ t }}</button>}
      </div>
    </app-page-header>
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!filtered().length) {<app-empty-state message="No agreements in this view." />}
    @else {
      <div class="card tight table-wrap">
        <table class="table">
          <thead><tr><th>Passport</th><th>Mode</th><th>Emitter</th><th>Utilizer</th><th class="r">Volume</th><th class="r">Price / t</th><th class="r">Value</th><th>Window</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (a of filtered(); track a.id) {
              <tr>
                <td class="mono">{{ a.passportCode }}</td>
                <td><app-status-badge [value]="a.mode" /></td>
                <td>{{ a.emitterName }}</td><td>{{ a.utilizerName }}</td>
                <td class="r">{{ a.volumeTonnes | tonnes }}@if (a.volumePerMonth) {<div class="muted small">{{ a.volumePerMonth | tonnes }}/mo × {{ a.durationMonths }}</div>}</td>
                <td class="r">{{ a.pricePerTonne | money }}</td>
                <td class="r">{{ a.totalValue | money }}</td>
                <td class="small">{{ a.startsAt | date:'mediumDate' }} → {{ a.endsAt | date:'mediumDate' }}</td>
                <td><app-status-badge [value]="a.status" /></td>
                <td><a class="btn btn-sm" [routerLink]="['/agreements', a.id]">Open</a></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }`,
})
export class AgreementsList {
  private api = inject(ApiService);
  rows = signal<AgreementDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  tabs = ['All', 'Active', 'Pending', 'Completed', 'Cancelled'];
  tab = signal('All');
  filtered = computed(() => {
    const t = this.tab();
    return this.rows().filter((a) => t === 'All' || (t === 'Active' && a.status === 'ACTIVE') || (t === 'Pending' && a.status === 'PENDING_VERIFICATION') || (t === 'Completed' && a.status === 'COMPLETED') || (t === 'Cancelled' && a.status === 'CANCELLED'));
  });
  constructor() {
    this.api.agreements().subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
