import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { NotificationService } from '../core/notification.service';
import { ApiService } from '../core/api.service';
import { Role, Tier } from '../core/models';
import { TierBadge } from '../shared/badges';
import { LabelPipe } from '../shared/pipes';

interface NavItem { label: string; link: string; icon: string; exact?: boolean; }

const NAV: Record<Role, NavItem[]> = {
  ADMIN: [
    { label: 'Approvals', link: '/admin', icon: '✓', exact: true },
    { label: 'Companies', link: '/admin/companies', icon: '▦' },
    { label: 'Audit trail', link: '/admin/audit', icon: '⛓' },
  ],
  EMITTER: [
    { label: 'Dashboard', link: '/emitter', icon: '◈', exact: true },
    { label: 'CO₂ Passports', link: '/emitter/passports', icon: '▤' },
    { label: 'Listings', link: '/emitter/listings', icon: '▣' },
    { label: 'Agreements', link: '/emitter/agreements', icon: '✎' },
    { label: 'Negotiations', link: '/emitter/negotiations', icon: '⇄' },
    { label: 'Shipments', link: '/emitter/shipments', icon: '⛟' },
  ],
  UTILIZER: [
    { label: 'Dashboard', link: '/utilizer', icon: '◈', exact: true },
    { label: 'Marketplace', link: '/utilizer/marketplace', icon: '▣' },
    { label: 'My proposals', link: '/utilizer/proposals', icon: '✉' },
    { label: 'Agreements', link: '/utilizer/agreements', icon: '✎' },
    { label: 'Negotiations', link: '/utilizer/negotiations', icon: '⇄' },
    { label: 'Shipments', link: '/utilizer/shipments', icon: '⛟' },
    { label: 'Trust profile', link: '/utilizer/trust', icon: '◆' },
  ],
  TRANSPORT: [
    { label: 'Offers', link: '/transport', icon: '✉', exact: true },
    { label: 'My shipments', link: '/transport/shipments', icon: '⛟' },
  ],
  LAB: [
    { label: 'Queue', link: '/lab', icon: '☰', exact: true },
    { label: 'History', link: '/lab/history', icon: '⌛' },
  ],
  REGULATOR: [
    { label: 'Overview', link: '/regulator', icon: '◈', exact: true },
    { label: 'Companies', link: '/regulator/companies', icon: '▦' },
    { label: 'Audit trail', link: '/regulator/audit', icon: '⛓' },
  ],
};

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TierBadge, LabelPipe],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" routerLink="/"><span class="logo">C₂</span><span>CarbonLoop<small>CO₂ marketplace</small></span></a>
        <div class="nav-section">{{ role() | label }}</div>
        <nav class="nav">
          @for (n of items(); track n.link) {
            <a [routerLink]="n.link" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!n.exact }"><span class="ico">{{ n.icon }}</span>{{ n.label }}</a>
          }
          <div class="nav-section">General</div>
          <a routerLink="/notifications" routerLinkActive="active"><span class="ico">🔔</span>Notifications
            @if (notif.unread() > 0) {<span class="badge status-danger" style="margin-left:auto">{{ notif.unread() }}</span>}
          </a>
        </nav>
        <div class="sidebar-footer">Rule-based matching · no AI/ML · no blockchain</div>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="who">
            <span class="name">{{ user()?.companyName }}</span>
            <app-tier-badge [tier]="tier()" />
            <span class="muted small">{{ user()?.fullName }}</span>
          </div>
          <div class="row">
            <a class="bell" routerLink="/notifications" title="Notifications">🔔 @if (notif.unread() > 0) {<span class="count">{{ notif.unread() }}</span>}</a>
            <button class="btn btn-sm" (click)="auth.logout()">Log out</button>
          </div>
        </header>
        <main class="content"><router-outlet /></main>
      </div>
    </div>`,
})
export class Shell {
  auth = inject(AuthService);
  notif = inject(NotificationService);
  private api = inject(ApiService);
  user = this.auth.user;
  role = this.auth.role;
  items = computed(() => (this.role() ? NAV[this.role()!] : []));
  tier = signal<Tier | null>(null);

  constructor() {
    if (this.auth.hasRole('EMITTER', 'UTILIZER')) {
      this.api.myTrust().subscribe({ next: (t) => this.tier.set(t.tier), error: () => {} });
    }
  }
}

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="public-shell">
      <nav class="public-nav">
        <a class="brand" routerLink="/"><span class="logo">C₂</span><span>CarbonLoop<small>Circular carbon marketplace</small></span></a>
        <div class="links">
          @if (auth.isLoggedIn()) {
            <a class="btn btn-primary" [routerLink]="auth.homeFor(auth.role())">Go to dashboard</a>
          } @else {
            <a class="btn" routerLink="/login">Log in</a>
            <a class="btn btn-primary" routerLink="/register">Register company</a>
          }
        </div>
      </nav>
      <div class="public-content"><router-outlet /></div>
    </div>`,
})
export class PublicLayout {
  auth = inject(AuthService);
}
