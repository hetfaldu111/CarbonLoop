import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { PassportDto, VerificationRequestDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-lab-queue',
  imports: [DatePipe, RouterLink, StatusBadge, LabelPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="Verification queue" subtitle="Priority-ordered, then oldest first. Passport COAs verify claimed specs; sale approvals gate agreements before they go active.">
      <button class="btn btn-sm" (click)="load()">Refresh</button>
    </app-page-header>
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else {
      @if (expiring().length) {
        <div class="alert alert-warn"><strong>{{ expiring().length }} COA{{ expiring().length === 1 ? '' : 's' }} expiring within 30 days:</strong> @for (p of expiring(); track p.id) {<span class="mono">{{ p.passportCode }}</span> ({{ p.coaExpiresAt | date:'mediumDate' }}) }</div>
      }
      @if (!rows().length) {<app-empty-state message="Queue is empty." icon="✓" />}
      @else {
        <div class="card tight table-wrap"><table class="table">
          <thead><tr><th>Priority</th><th>Type</th><th>Passport</th><th>Emitter</th><th>Agreement</th><th>Status</th><th>Submitted</th><th></th></tr></thead>
          <tbody>@for (r of rows(); track r.id) {
            <tr>
              <td><span class="badge" [class]="'badge ' + (r.priority >= 4 ? 'status-danger' : r.priority === 3 ? 'status-warn' : 'status-neutral')">P{{ r.priority }}</span></td>
              <td>{{ r.type | label }}</td>
              <td class="mono">{{ r.passportCode || '—' }}</td>
              <td>{{ r.emitterName || '—' }}</td>
              <td class="small">@if (r.agreementId) {<a [routerLink]="['/agreements', r.agreementId]">view</a>} @else {—}</td>
              <td><app-status-badge [value]="r.status" /></td>
              <td class="small">{{ r.submittedAt | date:'medium' }}</td>
              <td class="nowrap">
                @if (r.status === 'QUEUED') {<button class="btn btn-primary btn-sm" (click)="claim(r)" [disabled]="busy()">Claim</button>}
                <a class="btn btn-sm" [routerLink]="['/lab/requests', r.id]">Open</a>
              </td>
            </tr>
          }</tbody>
        </table></div>
      }
    }`,
})
export class LabQueue {
  private api = inject(ApiService);
  rows = signal<VerificationRequestDto[]>([]);
  expiring = signal<PassportDto[]>([]);
  loading = signal(true);
  busy = signal(false);
  error = signal<string | null>(null);
  constructor() { this.load(); }
  load(): void {
    this.loading.set(true);
    forkJoin({ q: this.api.verificationQueue(), e: this.api.verificationExpiring() }).subscribe({
      next: ({ q, e }) => { this.rows.set(q); this.expiring.set(e); this.loading.set(false); },
      error: (err) => { this.error.set(errMsg(err)); this.loading.set(false); },
    });
  }
  claim(r: VerificationRequestDto): void {
    this.busy.set(true);
    this.api.claimVerification(r.id).subscribe({ next: () => { this.busy.set(false); this.load(); }, error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); } });
  }
}
