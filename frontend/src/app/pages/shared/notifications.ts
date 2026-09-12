import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { NotificationDto } from '../../core/models';
import { NotificationService } from '../../core/notification.service';
import { StatusBadge } from '../../shared/badges';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-notifications',
  imports: [DatePipe, RouterLink, StatusBadge, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="Notifications" subtitle="Tender awards, shipment flags, contract expiry, forecast shortfalls, verification results and more.">
      <button class="btn btn-sm" (click)="markAll()" [disabled]="!hasUnread()">Mark all read</button>
    </app-page-header>
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!rows().length) {<app-empty-state message="No notifications yet." icon="🔔" />}
    @else {
      <div class="card tight">
        @for (n of rows(); track n.id) {
          <div class="notif" [class.unread]="!n.read">
            <span class="dot" [class.read]="n.read"></span>
            <div style="flex:1">
              <div class="row between">
                <div><strong>{{ n.title }}</strong> <app-status-badge [value]="n.type" /></div>
                <span class="muted small nowrap">{{ n.createdAt | date:'medium' }}</span>
              </div>
              <div class="small" style="white-space:pre-line">{{ n.message }}</div>
              <div class="row mt" style="gap:0.5rem">
                @if (link(n); as l) {<a class="btn btn-sm" [routerLink]="l">Open</a>}
                @if (!n.read) {<button class="btn btn-ghost btn-sm" (click)="read(n)">Mark read</button>}
              </div>
            </div>
          </div>
        }
      </div>
    }`,
})
export class Notifications {
  private api = inject(ApiService);
  private notif = inject(NotificationService);
  rows = signal<NotificationDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  constructor() { this.load(); }
  hasUnread(): boolean { return this.rows().some((n) => !n.read); }
  load(): void {
    this.api.notifications().subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
  read(n: NotificationDto): void {
    this.api.markRead(n.id).subscribe({ next: () => { this.rows.update((rs) => rs.map((x) => (x.id === n.id ? { ...x, read: true } : x))); this.notif.refresh(); }, error: (e) => this.error.set(errMsg(e)) });
  }
  markAll(): void {
    this.api.markAllRead().subscribe({ next: () => { this.rows.update((rs) => rs.map((x) => ({ ...x, read: true }))); this.notif.refresh(); }, error: (e) => this.error.set(errMsg(e)) });
  }
  link(n: NotificationDto): string | null {
    if (!n.referenceId) return null;
    switch ((n.referenceType || '').toUpperCase()) {
      case 'AGREEMENT': return `/agreements/${n.referenceId}`;
      case 'SHIPMENT': return `/shipments/${n.referenceId}`;
      case 'LISTING': return `/listings/${n.referenceId}`;
      case 'NEGOTIATION': return `/negotiations/${n.referenceId}`;
      case 'PASSPORT': return `/emitter/passports/${n.referenceId}`;
      case 'VERIFICATION_REQUEST': return `/lab/requests/${n.referenceId}`;
      default: return null;
    }
  }
}
