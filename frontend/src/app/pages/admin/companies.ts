import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CompanyDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-admin-companies',
  imports: [DatePipe, FormsModule, StatusBadge, LabelPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="All companies" subtitle="Every registered company across all roles.">
      <select [(ngModel)]="status" (ngModelChange)="load()" style="width:auto">
        <option value="">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option>
      </select>
      <select [ngModel]="roleSig()" (ngModelChange)="roleSig.set($event)" style="width:auto">
        <option value="">All roles</option>@for (r of roles; track r) {<option [value]="r">{{ r | label }}</option>}
      </select>
    </app-page-header>
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!filtered().length) {<app-empty-state message="No companies match." />}
    @else {
      <div class="card tight table-wrap">
        <table class="table">
          <thead><tr><th>Company</th><th>Role</th><th>Sector</th><th>Location</th><th>Status</th><th>Contact</th><th>Registered</th></tr></thead>
          <tbody>
            @for (c of filtered(); track c.id) {
              <tr>
                <td><strong>{{ c.name }}</strong><div class="muted small">{{ c.registrationNumber }}</div></td>
                <td><app-status-badge [value]="c.role" /></td>
                <td>{{ c.sector | label }}</td>
                <td>{{ c.city }}, {{ c.state }}</td>
                <td><app-status-badge [value]="c.status" />@if (c.rejectionReason) {<div class="muted small">{{ c.rejectionReason }}</div>}</td>
                <td class="small">{{ c.contactEmail }}<br />{{ c.contactPhone }}</td>
                <td class="small">{{ c.createdAt | date:'mediumDate' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }`,
})
export class AdminCompanies {
  private api = inject(ApiService);
  rows = signal<CompanyDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  status = '';
  roles = ['ADMIN', 'EMITTER', 'UTILIZER', 'TRANSPORT', 'LAB', 'REGULATOR'];
  roleSig = signal('');
  filtered = computed(() => this.rows().filter((c) => !this.roleSig() || c.role === this.roleSig()));

  constructor() { this.load(); }
  load(): void {
    this.loading.set(true);
    this.api.adminCompanies(this.status || undefined).subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
