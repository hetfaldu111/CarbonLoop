import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { VerificationRequestDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-lab-history',
  imports: [DatePipe, RouterLink, StatusBadge, LabelPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="Verification history" subtitle="Decided requests." />
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!rows().length) {<app-empty-state message="No decisions yet." />}
    @else {
      <div class="card tight table-wrap"><table class="table">
        <thead><tr><th>Type</th><th>Passport</th><th>Emitter</th><th>Outcome</th><th>Submitted</th><th>Decided</th><th>Notes</th><th></th></tr></thead>
        <tbody>@for (r of rows(); track r.id) {<tr><td>{{ r.type | label }}</td><td class="mono">{{ r.passportCode || '—' }}</td><td>{{ r.emitterName || '—' }}</td><td><app-status-badge [value]="r.status" /></td><td class="small">{{ r.submittedAt | date:'mediumDate' }}</td><td class="small">{{ r.decidedAt | date:'medium' }}</td><td class="small muted">{{ r.notes }}</td><td><a class="btn btn-sm" [routerLink]="['/lab/requests', r.id]">Open</a></td></tr>}</tbody>
      </table></div>
    }`,
})
export class LabHistory {
  private api = inject(ApiService);
  rows = signal<VerificationRequestDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  constructor() {
    this.api.verificationHistory().subscribe({ next: (r) => { this.rows.set(r); this.loading.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); } });
  }
}
