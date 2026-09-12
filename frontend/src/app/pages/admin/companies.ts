import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CompanyDto, INDIAN_STATES, SECTORS } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

type Criterion = 'name' | 'role' | 'sector' | 'city' | 'state' | 'status';

const CRITERIA: { key: Criterion; label: string }[] = [
  { key: 'name', label: 'Company name' },
  { key: 'role', label: 'Role' },
  { key: 'sector', label: 'Sector' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'status', label: 'Status' },
];

const ROLES = ['ADMIN', 'EMITTER', 'UTILIZER', 'TRANSPORT', 'LAB', 'REGULATOR'];
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

@Component({
  selector: 'app-admin-companies',
  imports: [DatePipe, FormsModule, RouterLink, StatusBadge, LabelPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="All companies" subtitle="Every registered company across all roles. Search by any single criterion." />

    <div class="card tight mb">
      <div class="row">
        <div class="field" style="max-width:190px;margin:0">
          <label class="small muted">Search by</label>
          <select [ngModel]="criterion()" (ngModelChange)="setCriterion($event)">
            @for (c of criteria; track c.key) {<option [value]="c.key">{{ c.label }}</option>}
          </select>
        </div>
        <div class="field" style="max-width:280px;margin:0">
          <label class="small muted">Value</label>
          @if (isChoice()) {
            <select [ngModel]="value()" (ngModelChange)="value.set($event)">
              <option value="">Any</option>
              @for (o of options(); track o) {<option [value]="o">{{ o | label }}</option>}
            </select>
          } @else {
            <input [ngModel]="value()" (ngModelChange)="value.set($event)" [placeholder]="'Type part of the ' + criterionLabel().toLowerCase()" />
          }
        </div>
        <div class="spacer"></div>
        <span class="muted small">Showing {{ filtered().length }} of {{ rows().length }} companies</span>
        <button class="btn btn-sm" (click)="clear()" [disabled]="!value()">Clear</button>
      </div>
    </div>

    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!filtered().length) {
      <app-empty-state [message]="rows().length ? 'No company matches that search.' : 'No companies registered yet.'" icon="▦" />
    }
    @else {
      <div class="card tight table-wrap">
        <table class="table">
          <thead><tr><th>Company</th><th>Role</th><th>Sector</th><th>Location</th><th>Status</th><th>Contact</th><th>Registered</th></tr></thead>
          <tbody>
            @for (c of filtered(); track c.id) {
              <tr>
                <td><a [routerLink]="['/admin/companies', c.id]"><strong>{{ c.name }}</strong></a><div class="muted small">{{ c.registrationNumber }}</div></td>
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
  criteria = CRITERIA;
  rows = signal<CompanyDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  criterion = signal<Criterion>('name');
  value = signal('');

  /** Role, sector and status are picked from a list; the rest are free-text substring matches. */
  isChoice = computed(() => ['role', 'sector', 'status'].includes(this.criterion()));

  options = computed<readonly string[]>(() => {
    switch (this.criterion()) {
      case 'role': return ROLES;
      case 'sector': return SECTORS;
      case 'status': return STATUSES;
      case 'state': return INDIAN_STATES;
      default: return [];
    }
  });

  criterionLabel = computed(() => CRITERIA.find((c) => c.key === this.criterion())?.label ?? '');

  filtered = computed(() => {
    const v = this.value().trim().toLowerCase();
    if (!v) return this.rows();
    const key = this.criterion();
    return this.rows().filter((c) => {
      const field = key === 'name' ? c.name : key === 'role' ? c.role : key === 'sector' ? c.sector : key === 'city' ? c.city : key === 'state' ? c.state : c.status;
      const s = String(field ?? '').toLowerCase();
      return this.isChoice() ? s === v : s.includes(v);
    });
  });

  setCriterion(c: Criterion): void { this.criterion.set(c); this.value.set(''); }
  clear(): void { this.value.set(''); }

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.adminCompanies().subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
