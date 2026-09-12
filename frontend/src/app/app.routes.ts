import { Component, inject, input, signal } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ApiService } from './core/api.service';
import { authGuard, roleGuard, guestGuard } from './core/guards';
import { PublicLayout, Shell } from './layout/shell';
import { Landing } from './pages/public/landing';
import { Login } from './pages/public/login';
import { Register } from './pages/public/register';
import { AdminApprovals } from './pages/admin/approvals';
import { AdminCompanies } from './pages/admin/companies';
import { AdminCompanyDetail } from './pages/admin/company-detail';
import { AuditLog } from './pages/shared/audit-log';
import { Notifications } from './pages/shared/notifications';
import { AgreementsList } from './pages/shared/agreements-list';
import { AgreementDetail } from './pages/shared/agreement-detail';
import { ShipmentsList } from './pages/shared/shipments-list';
import { ShipmentDetail } from './pages/shared/shipment-detail';
import { NegotiationDetail, NegotiationNew, NegotiationsList } from './pages/shared/negotiations';
import { EmitterDashboard } from './pages/emitter/dashboard';
import { Passports } from './pages/emitter/passports';
import { PassportForm } from './pages/emitter/passport-form';
import { PassportDetail } from './pages/emitter/passport-detail';
import { EmitterListings } from './pages/emitter/listings';
import { ListingForm } from './pages/emitter/listing-form';
import { EmitterListingDetail } from './pages/emitter/listing-detail';
import { EmitterAuctions } from './pages/emitter/auctions';
import { AuctionForm } from './pages/emitter/auction-form';
import { UtilizerDashboard } from './pages/utilizer/dashboard';
import { Marketplace } from './pages/utilizer/marketplace';
import { UtilizerListingDetail } from './pages/utilizer/listing-detail';
import { MyProposals } from './pages/utilizer/proposals';
import { UtilizerAuctions } from './pages/utilizer/auctions';
import { AuctionRoom } from './pages/shared/auction-room';
import { TransportOffers } from './pages/transport/offers';
import { LabQueue } from './pages/lab/queue';
import { LabRequestDetail } from './pages/lab/request-detail';
import { LabHistory } from './pages/lab/history';
import { RegulatorOverviewPage } from './pages/regulator/overview';
import { RegulatorCompanies } from './pages/regulator/companies';
import { RegulatorCompanyDetailPage } from './pages/regulator/company-detail';

/**
 * Resolves role-neutral links (e.g. from notifications) to the role-specific page.
 * Auction listings route to the live auction room rather than the tender detail page,
 * so a TENDER_PUBLISHED / AUCTION_SCHEDULED notification always lands somewhere useful.
 */
@Component({
  selector: 'app-role-redirect',
  template: `<p class="muted" style="padding:2rem">{{ note() }}</p>`,
})
export class RoleRedirect {
  id = input.required<string>();
  kind = input.required<'listings' | 'negotiations'>();
  note = signal('Opening…');
  constructor() {
    const auth = inject(AuthService);
    const api = inject(ApiService);
    const router = inject(Router);
    queueMicrotask(() => {
      const base = auth.hasRole('EMITTER') ? '/emitter' : auth.hasRole('UTILIZER') ? '/utilizer' : null;
      if (!base) { router.navigateByUrl(auth.homeFor(auth.role())); return; }
      if (this.kind() !== 'listings') { router.navigateByUrl(`${base}/${this.kind()}/${this.id()}`); return; }
      api.listing(this.id()).subscribe({
        next: (l) => router.navigateByUrl(l.mode === 'AUCTION' ? `${base}/auctions/${this.id()}` : `${base}/listings/${this.id()}`),
        error: () => { this.note.set('That listing is no longer available.'); router.navigateByUrl(`${base}/listings/${this.id()}`); },
      });
    });
  }
}

export const routes: Routes = [
  {
    path: '', component: PublicLayout, children: [
      { path: '', component: Landing, title: 'CarbonLoop — CO₂ marketplace' },
      { path: 'login', component: Login, title: 'Log in', canActivate: [guestGuard] },
      { path: 'register', component: Register, title: 'Register', canActivate: [guestGuard] },
    ],
  },
  {
    path: '', component: Shell, canActivate: [authGuard], children: [
      { path: 'notifications', component: Notifications, title: 'Notifications' },
      { path: 'agreements/:id', component: AgreementDetail, title: 'Agreement' },
      { path: 'shipments/:id', component: ShipmentDetail, title: 'Shipment' },
      { path: 'listings/:id', component: RoleRedirect, data: { kind: 'listings' } },
      { path: 'negotiations/:id', component: RoleRedirect, data: { kind: 'negotiations' } },

      { path: 'admin', canActivate: [roleGuard('ADMIN')], children: [
        { path: '', component: AdminApprovals, title: 'Approvals' },
        { path: 'companies', component: AdminCompanies, title: 'Companies' },
        { path: 'companies/:id', component: AdminCompanyDetail, title: 'Company' },
      ] },

      { path: 'emitter', canActivate: [roleGuard('EMITTER')], children: [
        { path: '', component: EmitterDashboard, title: 'Emitter dashboard' },
        { path: 'passports', component: Passports, title: 'CO₂ Passports' },
        { path: 'passports/new', component: PassportForm, title: 'New passport' },
        { path: 'passports/:id', component: PassportDetail, title: 'Passport' },
        { path: 'listings', component: EmitterListings, title: 'My listings' },
        { path: 'listings/new', component: ListingForm, title: 'New listing' },
        { path: 'listings/:id', component: EmitterListingDetail, title: 'Listing' },
        { path: 'auctions', component: EmitterAuctions, title: 'My auctions' },
        { path: 'auctions/new', component: AuctionForm, title: 'New auction' },
        { path: 'auctions/:id', component: AuctionRoom, title: 'Auction' },
        { path: 'agreements', component: AgreementsList, title: 'Agreements' },
        { path: 'negotiations', component: NegotiationsList, title: 'Negotiations' },
        { path: 'negotiations/new', component: NegotiationNew, title: 'New negotiation' },
        { path: 'negotiations/:id', component: NegotiationDetail, title: 'Negotiation' },
        { path: 'shipments', component: ShipmentsList, title: 'Shipments' },
      ] },

      { path: 'utilizer', canActivate: [roleGuard('UTILIZER')], children: [
        { path: '', component: UtilizerDashboard, title: 'Utilizer dashboard' },
        { path: 'marketplace', component: Marketplace, title: 'Marketplace' },
        { path: 'listings/:id', component: UtilizerListingDetail, title: 'Listing' },
        { path: 'auctions', component: UtilizerAuctions, title: 'Auctions' },
        { path: 'auctions/:id', component: AuctionRoom, title: 'Auction room' },
        { path: 'proposals', component: MyProposals, title: 'My proposals' },
        { path: 'agreements', component: AgreementsList, title: 'Agreements' },
        { path: 'negotiations', component: NegotiationsList, title: 'Negotiations' },
        { path: 'negotiations/new', component: NegotiationNew, title: 'New negotiation' },
        { path: 'negotiations/:id', component: NegotiationDetail, title: 'Negotiation' },
        { path: 'shipments', component: ShipmentsList, title: 'Shipments' },
      ] },

      { path: 'transport', canActivate: [roleGuard('TRANSPORT')], children: [
        { path: '', component: TransportOffers, title: 'Shipment offers' },
        { path: 'shipments', component: ShipmentsList, title: 'My shipments' },
      ] },

      { path: 'lab', canActivate: [roleGuard('LAB')], children: [
        { path: '', component: LabQueue, title: 'Verification queue' },
        { path: 'requests/:id', component: LabRequestDetail, title: 'Verification request' },
        { path: 'history', component: LabHistory, title: 'Verification history' },
      ] },

      { path: 'regulator', canActivate: [roleGuard('REGULATOR', 'ADMIN')], children: [
        { path: '', component: RegulatorOverviewPage, title: 'Regulator overview' },
        { path: 'companies', component: RegulatorCompanies, title: 'Companies' },
        { path: 'companies/:id', component: RegulatorCompanyDetailPage, title: 'Company' },
        { path: 'audit', component: AuditLog, title: 'Audit trail' },
      ] },
    ],
  },
  { path: '**', redirectTo: '' },
];
