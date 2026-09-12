import { Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { NotificationService } from '../core/notification.service';
import { ApiService } from '../core/api.service';
import { Role, Tier } from '../core/models';
import { TierBadge } from '../shared/badges';
import { LabelPipe } from '../shared/pipes';

interface NavItem { label: string; link: string; icon: string; exact?: boolean; live?: boolean; }

/**
 * Thin-line nav glyphs for the trading portals (emitter and utilizer), matching the supplied
 * design. The other four roles keep the existing text glyphs, so their sidebars are untouched.
 */
const PORTAL_ICONS: Record<string, string> = {
  dashboard: '<rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/>',
  passport: '<rect x="2" y="1" width="12" height="14" rx="1.5"/><line x1="5" y1="5" x2="11" y2="5"/><line x1="5" y1="8" x2="11" y2="8"/><line x1="5" y1="11" x2="8" y2="11"/><circle cx="11" cy="10.5" r="2"/>',
  list: '<rect x="1" y="2" width="14" height="12" rx="2"/><line x1="5" y1="6" x2="11" y2="6"/><line x1="5" y1="8" x2="11" y2="8"/><line x1="5" y1="10" x2="8" y2="10"/>',
  auction: '<path d="M2 14l4-4"/><path d="M5 11l5-9 3 2-5 9z"/><path d="M10 3l2-1 1 1-1 2"/><line x1="1" y1="14" x2="6" y2="14"/>',
  agreement: '<path d="M2 4 Q4 2 8 4 Q12 6 14 4"/><path d="M2 8 Q4 6 8 8 Q12 10 14 8"/><path d="M2 12 Q4 10 8 12 Q12 14 14 12"/>',
  negotiation: '<path d="M2 5h12M14 11H2"/><path d="M5 2l3 3-3 3"/><path d="M11 14l-3-3 3-3"/>',
  shipment: '<rect x="1" y="5" width="9" height="8" rx="1"/><path d="M10 7h3l2 3v3h-5V7z"/><circle cx="4" cy="14" r="1.5"/><circle cx="12" cy="14" r="1.5"/>',
  // Utilizer-side glyphs
  market: '<line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/>',
  bolt: '<path d="M9 1.5L3.5 9H7l-.5 5.5L12.5 7H9l.5-5.5z"/>',
  proposal: '<path d="M2 9.5V4.2A1.7 1.7 0 013.7 2.5h8.6A1.7 1.7 0 0114 4.2v5.3"/><path d="M2 9.5h3.2l.9 1.8h3.8l.9-1.8H14v2.3a1.7 1.7 0 01-1.7 1.7H3.7A1.7 1.7 0 012 11.8V9.5z"/>',
  check: '<circle cx="8" cy="8" r="6.3"/><path d="M5.4 8.2l1.9 1.9 3.3-3.7"/>',
  chat: '<path d="M14 9.4a1.9 1.9 0 01-1.9 1.9H6.2L2.6 14V4.1A1.9 1.9 0 014.5 2.2h7.6A1.9 1.9 0 0114 4.1v5.3z"/>',
  badge: '<path d="M8 1.6l1.85 3.8 4.15.6-3 2.95.71 4.15L8 11.15 4.29 13.1 5 8.95l-3-2.95 4.15-.6L8 1.6z"/>',
};

const NAV: Record<Role, NavItem[]> = {
  ADMIN: [
    { label: 'Approvals', link: '/admin', icon: '✓', exact: true },
    { label: 'Companies', link: '/admin/companies', icon: '▦' },
  ],
  EMITTER: [
    { label: 'Dashboard', link: '/emitter', icon: 'dashboard', exact: true },
    { label: 'CO₂ Passports', link: '/emitter/passports', icon: 'passport' },
    { label: 'Listings', link: '/emitter/listings', icon: 'list' },
    { label: 'Live Auctions', link: '/emitter/auctions', icon: 'auction', live: true },
    { label: 'Agreements', link: '/emitter/agreements', icon: 'agreement' },
    { label: 'Negotiations', link: '/emitter/negotiations', icon: 'negotiation' },
    { label: 'Shipments', link: '/emitter/shipments', icon: 'shipment' },
  ],
  UTILIZER: [
    { label: 'Dashboard', link: '/utilizer', icon: 'dashboard', exact: true },
    { label: 'Marketplace', link: '/utilizer/marketplace', icon: 'market' },
    { label: 'Auctions', link: '/utilizer/auctions', icon: 'bolt' },
    { label: 'My proposals', link: '/utilizer/proposals', icon: 'proposal' },
    { label: 'Agreements', link: '/utilizer/agreements', icon: 'check' },
    { label: 'Negotiations', link: '/utilizer/negotiations', icon: 'chat' },
    { label: 'Shipments', link: '/utilizer/shipments', icon: 'shipment' },
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
    <div class="shell" [class.portal]="portalDesign">
      <aside class="sidebar">
        <a class="brand" [routerLink]="home()">
          <span class="logo">
            @if (portalDesign) {
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="6.5" stroke="#4ade80" stroke-width="1.5" />
                <circle cx="9" cy="9" r="2.5" fill="#4ade80" />
              </svg>
            } @else {
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="#1A3C2A" stroke-width="1.5" />
                <path d="M 14,3 A 11,11 0 1,1 3,14" stroke="#30BE69" stroke-width="2" stroke-linecap="round" fill="none" />
                <circle cx="14" cy="3" r="2.5" fill="#30BE69" />
                <polygon points="3,11 3,17 7,14" fill="#30BE69" />
                <circle cx="14" cy="14" r="3" fill="#1A3C2A" />
              </svg>
            }
          </span>
          <span>Carbon<span [style.color]="portalDesign ? '#4ade80' : 'var(--eco)'">Loop</span><small>CO₂ marketplace</small></span>
        </a>
        <div class="nav-section">{{ role() | label }}</div>
        <nav class="nav">
          @for (n of items(); track n.link) {
            <a [routerLink]="n.link" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!n.exact }">
              @if (portalDesign) {
                <span class="ico" [innerHTML]="iconFor(n.icon)"></span>
              } @else {
                <span class="ico">{{ n.icon }}</span>
              }
              {{ n.label }}
              @if (n.live) {<span class="live" aria-label="live"></span>}
            </a>
          }
        </nav>
        <div class="sidebar-footer">
          <button class="logout-btn" (click)="auth.logout()">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M6 14H3.5A1.5 1.5 0 012 12.5v-9A1.5 1.5 0 013.5 2H6" />
              <path d="M10.5 11L14 8l-3.5-3" /><line x1="14" y1="8" x2="6" y2="8" />
            </svg>
            Log out
          </button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <a class="who" [routerLink]="home()" title="Go to your dashboard">
            <span class="name">{{ user()?.companyName }}</span>
            <app-tier-badge [tier]="tier()" [basis]="basis()" />
          </a>
          <div class="row">
            <a class="bell" routerLink="/notifications" title="Notifications">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M8 1.5a4.5 4.5 0 00-4.5 4.5c0 2.5-.8 3.5-1.5 4.5h12c-.7-1-1.5-2-1.5-4.5A4.5 4.5 0 008 1.5z" />
                <path d="M6.5 13.5a1.5 1.5 0 003 0" />
              </svg>
              @if (notif.unread() > 0) {<span class="count">{{ notif.unread() }}</span>}</a>
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
  private sanitizer = inject(DomSanitizer);
  user = this.auth.user;
  role = this.auth.role;
  items = computed(() => (this.role() ? NAV[this.role()!] : []));
  /** Brand and the identity block both return the signed-in role to its own dashboard. */
  home = computed(() => this.auth.homeFor(this.role()));
  tier = signal<Tier | null>(null);
  basis = signal<string | null>(null);
  /** Emitter and utilizer share the dark trading-portal shell; the other roles keep the light one. */
  portalDesign = this.auth.hasRole('EMITTER', 'UTILIZER');

  /** Wraps a thin-line glyph path in an SVG. Paths are our own constants, never user input. */
  iconFor(key: string): SafeHtml {
    const body = PORTAL_ICONS[key] ?? '';
    return this.sanitizer.bypassSecurityTrustHtml(
      `<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,
    );
  }

  constructor() {
    if (this.auth.hasRole('EMITTER', 'UTILIZER')) {
      this.api.myTrust().subscribe({ next: (t) => { this.tier.set(t.tier); this.basis.set(t.badgeBasis ?? null); }, error: () => {} });
    }
  }
}

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="public-shell">
      <nav class="cl-nav" [class.scrolled]="scrolled()">
        <div class="cl-nav-inner">
          <a class="cl-logo" routerLink="/">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="#1A3C2A" stroke-width="1.5" />
              <path d="M 14,3 A 11,11 0 1,1 3,14" stroke="#30BE69" stroke-width="2" stroke-linecap="round" fill="none" />
              <circle cx="14" cy="3" r="2.5" fill="#30BE69" />
              <polygon points="3,11 3,17 7,14" fill="#30BE69" />
              <circle cx="14" cy="14" r="3" fill="#1A3C2A" />
            </svg>
            <span class="cl-logo-text">Carbon<span>Loop</span></span>
          </a>
          <div class="cl-nav-links">
            @if (auth.isLoggedIn()) {
              <a class="cl-pill" [routerLink]="auth.homeFor(auth.role())">Go to dashboard</a>
            } @else {
              <a class="lnk" routerLink="/login">Log in</a>
              <a class="cl-pill" routerLink="/register">Request Access</a>
            }
          </div>
        </div>
      </nav>
      <div class="public-content"><router-outlet /></div>
    </div>`,
})
export class PublicLayout {
  auth = inject(AuthService);
  private router = inject(Router);
  /** The nav is transparent over the hero and frosts once the page scrolls. */
  scrolled = signal(false);
  constructor() {
    window.addEventListener('scroll', () => this.scrolled.set(window.scrollY > 20), { passive: true });
  }
}
