import { Component, inject, signal } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { TrustDto } from '../../core/models';
import { TierBadge } from '../../shared/badges';
import { Alert, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-trust',
  imports: [DecimalPipe, PercentPipe, TierBadge, Alert, Loading, PageHeader],
  template: `
    <app-page-header title="Trust profile" subtitle="Your tier and hidden score come from one published formula. Nothing is modelled or predicted — it is arithmetic on your agreement history." />
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @if (t(); as t) {
      <div class="grid grid-4 mb">
        <div class="stat"><div class="label">Tier</div><div class="value" style="font-size:1.3rem"><app-tier-badge [tier]="t.tier" /></div><div class="sub">{{ t.companyName }}</div></div>
        <div class="stat"><div class="label">Hidden score</div><div class="value">{{ t.hiddenScore | number:'1.0-1' }}</div><div class="sub">out of 100</div></div>
        <div class="stat"><div class="label">Completion rate</div><div class="value">{{ t.completionRate | percent:'1.0-0' }}</div><div class="sub">{{ t.completedAgreements }} of {{ t.totalAgreements }} agreements</div></div>
        <div class="stat"><div class="label">Cancellations before expiry</div><div class="value" [class.neg]="t.cancellationsBeforeExpiry > 0">{{ t.cancellationsBeforeExpiry }}</div><div class="sub">rate {{ t.cancellationRate | percent:'1.0-1' }}</div></div>
      </div>
      <div class="grid grid-2">
        <div class="card">
          <h3>The formula</h3>
          <pre class="doc">{{ t.formula || defaultFormula }}</pre>
          <p class="small muted">Tier bands: Bronze &lt; 40 · Silver 40–69 · Gold 70–89 · Diamond ≥ 90. A brand-new company starts at a 50% completion baseline (Silver).</p>
        </div>
        <div class="card">
          <h3>How the tier affects you</h3>
          <ul class="small">
            <li><strong>Tender ranking:</strong> tier (20%) + hidden score (15%) together outweigh offered price (15%). Cancellation rate is the heaviest penalty (−30%).</li>
            <li><strong>Auction ranking:</strong> price dominates (45%), but tier and score still add 20% and cancellations still subtract 25%.</li>
            <li><strong>Emitters see your tier</strong> next to every proposal and the recommendation explains it.</li>
          </ul>
          <h3 class="mt">How to improve</h3>
          <ul class="small">
            <li>Complete agreements you win — each completion raises completion rate.</li>
            <li>Never cancel before the end date: each cancellation costs 15 points and raises your cancellation rate.</li>
            <li>Accept escrow / deposits and commit to longer durations to score higher regardless of tier.</li>
          </ul>
        </div>
      </div>
    }`,
})
export class TrustPage {
  private api = inject(ApiService);
  t = signal<TrustDto | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  defaultFormula = 'completion_rate = total == 0 ? 0.5 : completed / total\nhidden_score = clamp(completion_rate × 100 − cancellations_before_expiry × 15, 0, 100)';
  constructor() {
    this.api.myTrust().subscribe({ next: (t) => { this.t.set(t); this.loading.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); } });
  }
}
