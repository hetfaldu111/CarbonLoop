import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { RegulatorOverview } from '../../core/models';
import { LabelPipe } from '../../shared/pipes';
import { Alert, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-regulator-overview',
  imports: [DecimalPipe, RouterLink, LabelPipe, Alert, Loading, PageHeader],
  template: `
    <app-page-header title="Regulator overview" subtitle="Read-only oversight: aggregate CO₂ captured, traded and utilized by region, sector and month, plus compliance signals.">
      <a class="btn" routerLink="/regulator/companies">Company compliance</a>
      <a class="btn" routerLink="/regulator/audit">Audit trail</a>
    </app-page-header>
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @if (o(); as o) {
      <div class="grid grid-4 mb">
        <div class="stat"><div class="label">Captured (passports)</div><div class="value">{{ o.totals.capturedTonnes | number:'1.0-0' }} t</div><div class="sub">verified passport volume</div></div>
        <div class="stat"><div class="label">Listed</div><div class="value">{{ o.totals.listedTonnes | number:'1.0-0' }} t</div><div class="sub">open on the marketplace</div></div>
        <div class="stat"><div class="label">Traded</div><div class="value">{{ o.totals.tradedTonnes | number:'1.0-0' }} t</div><div class="sub">active + completed agreements</div></div>
        <div class="stat"><div class="label">Utilized</div><div class="value">{{ o.totals.utilizedTonnes | number:'1.0-0' }} t</div><div class="sub">delivered &amp; reconciled</div></div>
      </div>
      <div class="grid grid-2 mb">
        <div class="stat" [class.neg]="o.flaggedShipments > 0"><div class="label">Flagged shipments</div><div class="value" [style.color]="o.flaggedShipments ? 'var(--danger)' : ''">{{ o.flaggedShipments }}</div><div class="sub">seal / weight / purity / meter mismatches</div></div>
        <div class="stat"><div class="label">Expired COAs</div><div class="value" [style.color]="o.expiredCoas ? 'var(--warn)' : ''">{{ o.expiredCoas }}</div><div class="sub">passports awaiting re-test</div></div>
      </div>
      <div class="grid grid-2">
        <div class="card">
          <h3>By region</h3>
          @for (r of o.byRegion; track r.region) {
            <div class="hbar"><span>{{ r.region }}</span><div class="bar"><div [style.width.%]="pct(r.captured, maxRegion())" title="captured"></div></div><span class="r">{{ r.captured | number:'1.0-0' }} t</span></div>
            <div class="hbar" style="margin-top:-0.2rem"><span class="muted small">traded</span><div class="bar"><div class="alt" [style.width.%]="pct(r.traded, maxRegion())"></div></div><span class="r muted small">{{ r.traded | number:'1.0-0' }} t</span></div>
          } @empty {<p class="muted">No data.</p>}
        </div>
        <div class="card">
          <h3>By sector</h3>
          @for (s of o.bySector; track s.sector) {
            <div class="hbar"><span>{{ s.sector | label }}</span><div class="bar"><div [style.width.%]="pct(s.captured, maxSector())"></div></div><span class="r">{{ s.captured | number:'1.0-0' }} t</span></div>
            <div class="hbar" style="margin-top:-0.2rem"><span class="muted small">traded</span><div class="bar"><div class="alt" [style.width.%]="pct(s.traded, maxSector())"></div></div><span class="r muted small">{{ s.traded | number:'1.0-0' }} t</span></div>
          } @empty {<p class="muted">No data.</p>}
        </div>
      </div>
      <div class="card mt">
        <h3>By month</h3>
        <div class="table-wrap"><table class="table compact"><thead><tr><th>Month</th><th class="r">Traded (t)</th><th class="r">Utilized (t)</th><th style="width:40%">Trend</th></tr></thead>
          <tbody>@for (m of o.byMonth; track m.month) {<tr><td>{{ m.month }}</td><td class="r">{{ m.traded | number:'1.0-0' }}</td><td class="r">{{ m.utilized | number:'1.0-0' }}</td><td><div class="stacked-bar" style="height:10px;background:var(--surface-2)"><div class="seg seg-tender" [style.width.%]="pct(m.traded, maxMonth())"></div></div></td></tr>} @empty {<tr><td colspan="4" class="muted">No monthly data.</td></tr>}</tbody>
        </table></div>
      </div>
      <div class="card mt">
        <h3>Policy backdrop used for incentive flags</h3>
        <ul class="small">
          <li><strong>CCUS_VGF_2026</strong> — India's ₹20,000 crore CCUS allocation (2026-27) for Power / Steel / Cement / Refineries / Chemicals: sector match + ≥1 verified passport + ≥1 active/completed agreement.</li>
          <li><strong>NITI_CLUSTER_PILOT</strong> — NITI Aayog cluster-hub model: company located in Gujarat or Odisha.</li>
          <li><strong>CBAM_EXPORT_READY</strong> — EU CBAM financial phase (from 1 Jan 2026): party to a negotiated contract of ≥ 6 months.</li>
        </ul>
      </div>
    }`,
})
export class RegulatorOverviewPage {
  private api = inject(ApiService);
  o = signal<RegulatorOverview | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  maxRegion = computed(() => Math.max(1, ...(this.o()?.byRegion.map((r) => Math.max(r.captured, r.traded)) ?? [1])));
  maxSector = computed(() => Math.max(1, ...(this.o()?.bySector.map((r) => Math.max(r.captured, r.traded)) ?? [1])));
  maxMonth = computed(() => Math.max(1, ...(this.o()?.byMonth.map((r) => r.traded) ?? [1])));
  constructor() {
    this.api.regulatorOverview().subscribe({ next: (o) => { this.o.set(o); this.loading.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); } });
  }
  pct(v: number, max: number): number { return max > 0 ? (v / max) * 100 : 0; }
}
