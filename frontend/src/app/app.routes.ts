import { Component, inject, input } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { AuthService } from './core/auth.service';
import { authGuard, roleGuard } from './core/guards';
import { PublicLayout, Shell } from './layout/shell';
import { Landing } from './pages/public/landing';
import { Login } from './pages/public/login';
import { Register } from './pages/public/register';
import { AdminApprovals } from './pages/admin/approvals';
import { AdminCompanies } from './pages/admin/companies';
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
import { UtilizerDashboard } from './pages/utilizer/dashboard';
import { Marketplace } from './pages/utilizer/marketplace';
import { UtilizerListingDetail } from './pages/utilizer/listing-detail';
import { MyProposals } from './pages/utilizer/proposals';
import { TrustPage } from './pages/utilizer/trust';
import { TransportOffers } from './pages/transport/offers';
import { LabQueue } from './pages/lab/queue';
import { LabRequestDetail } from './pages/lab/request-detail';
import { LabHistory } from './pages/lab/history';
import { RegulatorOverviewPage } from './pages/regulator/overview';
import { RegulatorCompanies } from './pages/regulator/companies';
import { RegulatorCompanyDetailPage } from './pages/regulator/company-detail';

/** Resolves role-neutral links (e.g. from notifications) to the role-specific page. */
@Component({ selector: 'app-role-redirect', template: '' })
export class RoleRedirect {
  id = input.required<string>();
  kind = input.required<'listings' | 'negotiations'>();
  constructor() {
    const auth = inject(AuthService);
    const router = inject(Router);
    queueMicrotask(() => {
      const base = auth.hasRole('EMITTER') ? '/emitter' : auth.hasRole('UTILIZER') ? '/utilizer' : null;
      router.navigateByUrl(base ? `${base}/${this.kind()}/${this.id()}` : auth.homeFor(auth.role()));
    });
  }
}

export const routes: Routes = [
  {
    path: '', component: PublicLayout, children: [
      { path: '', component: Landing, title: 'CarbonLoop — CO₂ marketplace' },
      { path: 'login', component: Login, title: 'Log in' },
      { path: 'register', component: Register, title: 'Register' },
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
        { path: 'audit', component: AuditLog, title: 'Audit trail' },
      ] },

      { path: 'emitter', canActivate: [roleGuard('EMITTER')], children: [
        { path: '', component: EmitterDashboard, title: 'Emitter dashboard' },
        { path: 'passports', component: Passports, title: 'CO₂ Passports' },
        { path: 'passports/new', component: PassportForm, title: 'New passport' },
        { path: 'passports/:id', component: PassportDetail, title: 'Passport' },
        { path: 'listings', component: EmitterListings, title: 'My listings' },
        { path: 'listings/new', component: ListingForm, title: 'New listing' },
        { path: 'listings/:id', component: EmitterListingDetail, title: 'Listing' },
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
        { path: 'proposals', component: MyProposals, title: 'My proposals' },
        { path: 'agreements', component: AgreementsList, title: 'Agreements' },
        { path: 'negotiations', component: NegotiationsList, title: 'Negotiations' },
        { path: 'negotiations/new', component: NegotiationNew, title: 'New negotiation' },
        { path: 'negotiations/:id', component: NegotiationDetail, title: 'Negotiation' },
        { path: 'shipments', component: ShipmentsList, title: 'Shipments' },
        { path: 'trust', component: TrustPage, title: 'Trust profile' },
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
