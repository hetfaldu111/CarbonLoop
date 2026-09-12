import { Component, computed, input } from '@angular/core';
import { Tier } from '../core/models';
import { LabelPipe } from './pipes';

@Component({
  selector: 'app-tier-badge',
  imports: [LabelPipe],
  template: `@if (tier()) {<span class="badge tier tier-{{ tier()!.toLowerCase() }}" [title]="hint()">◆ {{ tier() | label }}</span>}`,
})
export class TierBadge {
  tier = input<Tier | null | undefined>();
  /** What the badge is earned on: emitters by volume sold, utilizers by completed agreements. */
  basis = input<string | null | undefined>();
  hint = computed(() => {
    const t = this.tier();
    const label = t ? t.charAt(0) + t.slice(1).toLowerCase() : '';
    const b = this.basis();
    return b ? `${label} badge, earned on ${b}` : `Trust tier: ${label}`;
  });
}

const TONE: Record<string, string> = {
  OPEN: 'info', AWARDED: 'success', CLOSED: 'neutral', CANCELLED: 'danger',
  SCHEDULED: 'warn', LIVE: 'danger', ENDED: 'neutral',
  SUBMITTED: 'info', REJECTED: 'danger', WITHDRAWN: 'neutral',
  PENDING_VERIFICATION: 'warn', ACTIVE: 'success', COMPLETED: 'neutral',
  ACCEPTED: 'success', COUNTERED: 'warn', PENDING: 'warn',
  REQUESTED: 'info', IN_TRANSIT: 'warn', DELIVERED: 'success', FLAGGED: 'danger',
  NOTIFIED: 'info', EXPIRED: 'neutral',
  QUEUED: 'info', IN_REVIEW: 'warn', APPROVED: 'success',
  VERIFIED: 'success', ISSUED: 'success', NONE: 'neutral',
  TENDER: 'tender', AUCTION: 'auction', CONTRACT: 'contract',
  PIPELINE: 'neutral', TRUCK: 'neutral', RAIL: 'neutral',
  EMITTER: 'tender', UTILIZER: 'contract', TRANSPORT: 'auction', LAB: 'info', REGULATOR: 'neutral', ADMIN: 'danger',
};

@Component({
  selector: 'app-status-badge',
  imports: [LabelPipe],
  template: `<span class="badge status-{{ tone() }}">{{ value() | label }}</span>`,
})
export class StatusBadge {
  value = input<string | null | undefined>();
  tone = computed(() => TONE[this.value() ?? ''] ?? 'neutral');
}
