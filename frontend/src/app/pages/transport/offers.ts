import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { TransportOfferDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-transport-offers',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, StatusBadge, LabelPipe, MoneyPipe, TonnesPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="Shipment offers" subtitle="You are notified for shipments loading within ~100 km of your base. First provider to accept wins the job.">
      <button class="btn btn-sm" (click)="load()">Refresh</button>
    </app-page-header>
    <app-alert [message]="error()" />
    <app-alert [message]="ok()" tone="success" />
    @if (loading()) {<app-loading />}
    @else {
      <h3>Open offers ({{ open().length }})</h3>
      @if (!open().length) {<app-empty-state message="No open offers right now." icon="✉" />}
      <div class="stack">
        @for (o of open(); track o.id) {
          <div class="card">
            <div class="row between">
              <div>
                <strong>{{ o.shipment.volumeTonnes | tonnes }} via {{ o.shipment.transportMode | label }}</strong> · <span class="mono">{{ o.shipment.passportCode }}</span>
                <div class="muted small">{{ o.shipment.emitterName }} → {{ o.shipment.utilizerName }} · route {{ o.shipment.distanceKm | number:'1.0-0' }} km · you are {{ o.distanceFromOriginKm | number:'1.0-0' }} km from origin · notified {{ o.createdAt | date:'medium' }}</div>
              </div>
              <div class="row">
                <input type="number" [(ngModel)]="quotes[o.id]" placeholder="Quoted price ₹" style="width:160px" />
                <button class="btn btn-primary btn-sm" (click)="accept(o)" [disabled]="busy() || !quotes[o.id]">Accept job</button>
                <button class="btn btn-sm" (click)="reject(o)" [disabled]="busy()">Reject</button>
              </div>
            </div>
            @if (o.shipment.flags.includes('NO_PROVIDER_IN_RANGE')) {<div class="alert alert-warn mt" style="margin-bottom:0">No provider inside 100 km — broadcast to all providers.</div>}
          </div>
        }
      </div>
      <h3 class="mt">History</h3>
      @if (!closed().length) {<p class="muted">Nothing yet.</p>}
      @else {
        <div class="card tight table-wrap"><table class="table compact">
          <thead><tr><th>Shipment</th><th>Route</th><th class="r">Volume</th><th class="r">Quoted</th><th>Offer status</th><th>Shipment status</th><th></th></tr></thead>
          <tbody>@for (o of closed(); track o.id) {<tr><td class="mono">{{ o.shipment.passportCode }}</td><td class="small">{{ o.shipment.emitterName }} → {{ o.shipment.utilizerName }}</td><td class="r">{{ o.shipment.volumeTonnes | tonnes }}</td><td class="r">{{ o.quotedPrice | money }}</td><td><app-status-badge [value]="o.status" /></td><td><app-status-badge [value]="o.shipment.status" /></td><td>@if (o.status === 'ACCEPTED') {<a class="btn btn-sm" [routerLink]="['/shipments', o.shipmentId]">Open</a>}</td></tr>}</tbody>
        </table></div>
      }
    }`,
})
export class TransportOffers {
  private api = inject(ApiService);
  rows = signal<TransportOfferDto[]>([]);
  loading = signal(true);
  busy = signal(false);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);
  quotes: Record<string, number | null> = {};
  open = computed(() => this.rows().filter((o) => o.status === 'NOTIFIED'));
  closed = computed(() => this.rows().filter((o) => o.status !== 'NOTIFIED'));
  constructor() { this.load(); }
  load(): void {
    this.loading.set(true);
    this.api.transportOffers().subscribe({
      next: (r) => { this.rows.set(r); for (const o of r) if (this.quotes[o.id] == null) this.quotes[o.id] = Math.round(o.shipment.distanceKm * o.shipment.volumeTonnes * (o.shipment.transportMode === 'RAIL' ? 2.5 : o.shipment.transportMode === 'PIPELINE' ? 0.8 : 4) + (o.shipment.transportMode === 'RAIL' ? 15000 : o.shipment.transportMode === 'PIPELINE' ? 0 : 5000)); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
  accept(o: TransportOfferDto): void {
    this.busy.set(true); this.error.set(null);
    this.api.acceptTransportOffer(o.id, +(this.quotes[o.id] ?? 0)).subscribe({ next: () => { this.busy.set(false); this.ok.set('Job accepted. Record loading from the shipment page once sealed.'); this.load(); }, error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); } });
  }
  reject(o: TransportOfferDto): void {
    this.busy.set(true); this.error.set(null);
    this.api.rejectTransportOffer(o.id).subscribe({ next: () => { this.busy.set(false); this.load(); }, error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); } });
  }
}
