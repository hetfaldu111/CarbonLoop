import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { TransportOfferDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, EmptyState, FieldError, Loading, PageHeader } from '../../shared/widgets';
import { Check, FieldErrors, errMsg } from '../../shared/utils';

@Component({
  selector: 'app-transport-offers',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, StatusBadge, LabelPipe, MoneyPipe, TonnesPipe, Alert, EmptyState, FieldError, Loading, PageHeader],
  template: `
    <app-page-header title="Shipment offers" subtitle="You are notified for shipments loading within ~100 km of your base. First provider to accept wins the job.">
      <button class="btn btn-sm" (click)="load()" [disabled]="loading()">Refresh</button>
    </app-page-header>
    <app-alert [message]="error()" />
    <app-alert [message]="ok()" tone="success" />

    @if (loading()) {<app-loading />}
    @else {
      <h3 class="section-title">Open offers ({{ open().length }})</h3>
      @if (!open().length) {<app-empty-state message="No open offers right now." icon="✉" />}
      @else {
        <div class="tp-stack">
          @for (o of open(); track o.id) {
            <div class="tp-offer">
              <div class="tp-offer-main">
                <div class="tp-offer-title">
                  <strong>{{ o.shipment.volumeTonnes | tonnes }} via {{ o.shipment.transportMode | label }}</strong>
                  <span class="tp-pid">{{ o.shipment.passportCode }}</span>
                </div>
                <div class="tp-offer-meta">
                  {{ o.shipment.emitterName }} → {{ o.shipment.utilizerName }}
                  · route {{ o.shipment.distanceKm | number:'1.0-0' }} km
                  · you are {{ o.distanceFromOriginKm | number:'1.0-0' }} km from origin
                  · notified {{ o.createdAt | date:'medium' }}
                </div>
                @if (o.shipment.flags.includes('NO_PROVIDER_IN_RANGE')) {
                  <div class="tp-broadcast">No provider inside 100 km — broadcast to every carrier.</div>
                }
              </div>
              <div class="tp-offer-act">
                <span class="field inline-field" [class.invalid]="fe()[o.id]">
                  <input type="number" [(ngModel)]="quotes[o.id]" [name]="'quote-' + o.id" placeholder="Quoted price ₹" required
                         [attr.aria-invalid]="fe()[o.id] ? 'true' : null" [attr.aria-label]="'Quoted price for ' + o.shipment.passportCode" />
                  <app-field-error [msg]="fe()[o.id]" />
                </span>
                <button class="btn btn-primary btn-sm" (click)="accept(o)" [disabled]="busy()">Accept job</button>
                <button class="btn btn-sm" (click)="reject(o)" [disabled]="busy()">Reject</button>
              </div>
            </div>
          }
        </div>
      }

      <h3 class="section-title tp-history">History</h3>
      @if (!closed().length) {<app-empty-state message="Nothing yet." icon="⌛" />}
      @else {
        <div class="card tight table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Shipment</th><th>Route</th><th class="r">Volume</th><th class="r">Quoted</th>
                <th>Offer status</th><th>Shipment status</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (o of closed(); track o.id) {
                <tr>
                  <td class="mono">{{ o.shipment.passportCode }}</td>
                  <td class="small">{{ o.shipment.emitterName }} → {{ o.shipment.utilizerName }}</td>
                  <td class="r">{{ o.shipment.volumeTonnes | tonnes }}</td>
                  <td class="r">{{ o.quotedPrice ? (o.quotedPrice | money) : '—' }}</td>
                  <td><app-status-badge [value]="o.status" /></td>
                  <td><app-status-badge [value]="o.shipment.status" /></td>
                  <td class="r">
                    @if (o.status === 'ACCEPTED') {<a class="btn btn-sm" [routerLink]="['/shipments', o.shipmentId]">Open</a>}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
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
  /** Keyed by offer id, since several offers are listed at once. */
  fe = signal<FieldErrors>({});

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.transportOffers().subscribe({
      next: (r) => {
        this.rows.set(r);
        for (const o of r) if (this.quotes[o.id] == null) this.quotes[o.id] = this.estimate(o);
        this.loading.set(false);
      },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }

  /** Prefilled suggestion using the same per-tonne-km rates the cost stack charges. */
  private estimate(o: TransportOfferDto): number {
    const mode = o.shipment.transportMode;
    const rate = mode === 'RAIL' ? 2.5 : mode === 'PIPELINE' ? 0.8 : 4;
    const fixed = mode === 'RAIL' ? 15000 : mode === 'PIPELINE' ? 0 : 5000;
    return Math.round(o.shipment.distanceKm * o.shipment.volumeTonnes * rate + fixed);
  }

  accept(o: TransportOfferDto): void {
    const c = new Check();
    c.num(o.id, this.quotes[o.id], 'Quoted price', { gt: 0 });
    if (!c.ok) { this.fe.set(c.errors); return; }
    this.fe.set({});
    this.busy.set(true); this.error.set(null);
    this.api.acceptTransportOffer(o.id, +(this.quotes[o.id] ?? 0)).subscribe({
      next: () => { this.busy.set(false); this.ok.set('Job accepted. Record loading from the shipment page once sealed.'); this.load(); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }

  reject(o: TransportOfferDto): void {
    this.busy.set(true); this.error.set(null);
    this.api.rejectTransportOffer(o.id).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
}
