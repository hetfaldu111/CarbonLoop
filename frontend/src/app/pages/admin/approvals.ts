import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CompanyDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe } from '../../shared/pipes';
import { Alert, EmptyState, FieldError, Loading, PageHeader } from '../../shared/widgets';
import { Check, errMsg } from '../../shared/utils';

@Component({
  selector: 'app-admin-approvals',
  imports: [DatePipe, FormsModule, StatusBadge, LabelPipe, Alert, EmptyState, FieldError, Loading, PageHeader],
  template: `
    <app-page-header title="Pending company approvals" subtitle="Review the sign-up form, then verify by call or site visit before approving. Nothing can transact until approved." />
    <app-alert [message]="error()" />
    <app-alert [message]="ok()" tone="success" />
    @if (loading()) {<app-loading />}
    @else if (!rows().length) {<app-empty-state message="No companies waiting for approval." icon="✓" />}
    @else {
      <div class="stack">
        @for (c of rows(); track c.id) {
          <div class="card">
            <div class="row between">
              <div>
                <h3 style="margin:0">{{ c.name }} <app-status-badge [value]="c.role" /> <span class="muted small">{{ c.sector | label }}</span></h3>
                <div class="muted small">Registered {{ c.createdAt | date:'medium' }} · {{ c.city }}, {{ c.state }}, {{ c.country }} · Reg# {{ c.registrationNumber }}</div>
              </div>
              <div class="row">
                <button class="btn btn-primary btn-sm" (click)="approve(c)" [disabled]="busy() === c.id">Approve</button>
                <button class="btn btn-danger btn-sm" (click)="rejecting.set(rejecting() === c.id ? null : c.id)">Reject…</button>
              </div>
            </div>
            <div class="grid grid-3 mt">
              <div><span class="muted small">Contact</span><div>{{ c.contactEmail }}<br />{{ c.contactPhone }}</div></div>
              <div><span class="muted small">Address</span><div>{{ c.address }}</div><div class="muted small">{{ c.latitude }}, {{ c.longitude }}</div></div>
              <div><span class="muted small">Role-specific profile</span>
                <dl class="kv">@for (e of entries(c.roleProfile); track e[0]) {<dt>{{ e[0] | label }}</dt><dd>{{ e[1] }}</dd>}</dl>
              </div>
            </div>
            @if (rejecting() === c.id) {
              <div class="row mt">
                <span class="field inline-field" [class.invalid]="reasonError()">
                  <input name="reason" [(ngModel)]="reason" placeholder="Reason for rejection (sent to the company)" required
                         [attr.aria-invalid]="reasonError() ? 'true' : null" style="max-width:520px" />
                  <app-field-error [msg]="reasonError()" />
                </span>
                <button class="btn btn-danger btn-sm" (click)="reject(c)" [disabled]="busy() === c.id">Confirm rejection</button>
              </div>
            }
          </div>
        }
      </div>
    }`,
})
export class AdminApprovals {
  private api = inject(ApiService);
  rows = signal<CompanyDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);
  busy = signal<string | null>(null);
  rejecting = signal<string | null>(null);
  reason = '';

  constructor() { this.load(); }
  load(): void {
    this.loading.set(true);
    this.api.adminCompanies('PENDING').subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
  entries(o?: Record<string, unknown>): [string, unknown][] { return o ? Object.entries(o) : []; }
  approve(c: CompanyDto): void {
    this.busy.set(c.id); this.error.set(null);
    this.api.approveCompany(c.id).subscribe({
      next: () => { this.ok.set(`${c.name} approved. They can now log in.`); this.busy.set(null); this.load(); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(null); },
    });
  }
  reasonError = signal<string | null>(null);

  reject(c: CompanyDto): void {
    const check = new Check();
    check.minLength('reason', this.reason, 5, 'A reason');
    if (!check.ok) { this.reasonError.set(check.errors['reason']); return; }
    this.reasonError.set(null);
    this.busy.set(c.id); this.error.set(null);
    this.api.rejectCompany(c.id, this.reason.trim()).subscribe({
      next: () => { this.ok.set(`${c.name} rejected.`); this.busy.set(null); this.rejecting.set(null); this.reason = ''; this.load(); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(null); },
    });
  }
}
