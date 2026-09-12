import { Component, inject, signal } from '@angular/core';
import { PercentPipe } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { TrustDto } from '../../core/models';
import { TierBadge } from '../../shared/badges';
import { Alert, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-trust',
  imports: [PercentPipe, TierBadge, Alert, Loading, PageHeader],
  template: `
    <app-page-header title="Trust profile" subtitle="Your badge is earned from your own trading record on this platform." />
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @if (t(); as t) {
      <div class="grid grid-4 mb">
        <div class="stat"><div class="label">Badge</div><div class="value" style="font-size:1.3rem"><app-tier-badge [tier]="t.tier" [basis]="t.badgeBasis" /></div><div class="sub">earned on {{ t.badgeBasis || 'completed agreements' }}@if (t.tonnesSold) {, {{ t.tonnesSold }} t sold}</div></div>
        <div class="stat"><div class="label">Agreements completed</div><div class="value">{{ t.completedAgreements }}</div><div class="sub">of {{ t.totalAgreements }} entered</div></div>
        <div class="stat"><div class="label">Completion rate</div><div class="value">{{ t.completionRate | percent:'1.0-0' }}</div><div class="sub">deals you saw through</div></div>
        <div class="stat"><div class="label">Cancellations before expiry</div><div class="value" [class.neg]="t.cancellationsBeforeExpiry > 0">{{ t.cancellationsBeforeExpiry }}</div><div class="sub">walked away early</div></div>
      </div>
      <div class="grid grid-2">
        <div class="card">
          <h3>What your badge means</h3>
          <p class="small">Badges run Bronze, Silver, Gold, Diamond. They are earned from your record here, not bought and not predicted by any model.</p>
          <ul class="small">
            <li><strong>Emitters see your badge</strong> beside every proposal and bid you submit.</li>
            <li><strong>It breaks ties.</strong> When two offers are worth the same to an emitter, the higher badge is preferred.</li>
            <li><strong>A new company starts mid-table</strong> and moves up or down with its first few deals.</li>
          </ul>
        </div>
        <div class="card">
          <h3>How to improve it</h3>
          <ul class="small">
            <li>Complete the agreements you win, every time.</li>
            <li>Do not cancel before the end date — walking away early is what costs you most.</li>
            <li>Accept escrow or a deposit, and commit to longer durations, to make your offers more attractive.</li>
            <li>Bid realistically so you can honour what you win.</li>
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
  constructor() {
    this.api.myTrust().subscribe({ next: (t) => { this.t.set(t); this.loading.set(false); }, error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); } });
  }
}
