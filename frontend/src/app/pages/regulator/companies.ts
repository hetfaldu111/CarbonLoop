import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { INDIAN_STATES, RegulatorCompanyRow } from '../../core/models';
import { StatusBadge, TierBadge } from '../../shared/badges';
import { LabelPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-regulator-companies',
  imports: [DecimalPipe, FormsModule, RouterLink, StatusBadge, TierBadge, LabelPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="Companies — compliance & incentives" subtitle="Red = compliance flag, green = qualifies for a known government scheme. All flags are rule-based.">
      <select [ngModel]="role()" (ngModelChange)="role.set($event)" style="width:auto"><option value="">All roles</option><option value="EMITTER">Emitters</option><option value="UTILIZER">Utilizers</option><option value="TRANSPORT">Transport</option><option value="LAB">Labs</option></select>
      <select [ngModel]="state()" (ngModelChange)="state.set($event)" style="width:auto"><option value="">All states</option>@for (s of states; track s) {<option [value]="s">{{ s }}</option>}</select>
      <label class="check"><input type="checkbox" [ngModel]="flaggedOnly()" (ngModelChange)="flaggedOnly.set($event)" /> flagged only</label>
    </app-page-header>
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!filtered().length) {<app-empty-state message="No companies match." />}
    @else {
      <div class="card tight table-wrap"><table class="table">
        <thead><tr><th>Company</th><th>Role</th><th>Sector</th><th>Location</th><th>Tier</th><th class="r">Score</th><th class="r">Verified passports</th><th class="r">Agreements</th><th>Compliance</th><th>Incentives</th><th></th></tr></thead>
        <tbody>@for (c of filtered(); track c.id) {
          <tr>
            <td><strong>{{ c.name }}</strong></td>
            <td><app-status-badge [value]="c.role" /></td>
            <td>{{ c.sector | label }}</td>
            <td>{{ c.city }}, {{ c.state }}</td>
            <td><app-tier-badge [tier]="c.tier" /></td>
            <td class="r">{{ c.hiddenScore | number:'1.0-0' }}</td>
            <td class="r">{{ c.verifiedPassports }}</td>
            <td class="r">{{ c.totalAgreements }}</td>
            <td>@for (f of c.complianceFlags; track f) {<span class="flag flag-red">{{ f }}</span>} @empty {<span class="muted small">clean</span>}</td>
            <td>@for (f of c.incentiveFlags; track f) {<span class="flag flag-green">{{ f }}</span>} @empty {<span class="muted small">—</span>}</td>
            <td><a class="btn btn-sm" [routerLink]="['/regulator/companies', c.id]">Drill down</a></td>
          </tr>
        }</tbody>
      </table></div>
    }`,
})
export class RegulatorCompanies {
  private api = inject(ApiService);
  states = INDIAN_STATES;
  rows = signal<RegulatorCompanyRow[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  role = signal('');
  state = signal('');
  flaggedOnly = signal(false);
  filtered = computed(() => this.rows().filter((c) => (!this.role() || c.role === this.role()) && (!this.state() || c.state === this.state()) && (!this.flaggedOnly() || c.complianceFlags.length > 0)));
  constructor() {
    this.api.regulatorCompanies().subscribe({ next: (r) => { this.rows.set(r); this.loading.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); } });
  }
}
