import { Component, computed, input } from '@angular/core';
import { Tier } from '../core/models';
import { LabelPipe } from './pipes';

@Component({
  selector: 'app-tier-badge',
  imports: [LabelPipe],
  template: `@if (tier()) {<span class="badge tier tier-{{ tier()!.toLowerCase() }}" [title]="'Trust tier: ' + (tier() | label)">◆ {{ tier() | label }}</span>}`,
})
export class TierBadge {
  tier = input<Tier | null | undefined>();
}

const TONE: Record<string, string> = {
  OPEN: 'info', AWARDED: 'success', CLOSED: 'neutral', CANCELLED: 'danger',
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
