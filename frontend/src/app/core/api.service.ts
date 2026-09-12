import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AgreementDto, AllocationDto, AuditEventDto, CompanyDto, ContractOfferDto, ContractOfferInput, CostEstimateDto,
  CostEstimateRequest, CreateListingRequest, CreateNegotiationRequest, CreateProposalRequest, CreateShipmentRequest,
  DecideRequest, DeliverRequest, DirectoryEntry, ForecastDto, ImpactDto, ListingDto, LoadRequest, NegotiationDto,
  NotificationDto, Page, PassportDto, PassportPublicDto, ProposalDto, PublicListingDto, RatesDto, RegulatorCompanyDetail,
  RegulatorCompanyRow, RegulatorOverview, ShipmentDto, TransportOfferDto, TrustDto, VerificationRequestDto,
} from './models';

type Params = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  private params(p?: Params): HttpParams {
    let hp = new HttpParams();
    if (p) for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== '') hp = hp.set(k, String(v));
    return hp;
  }

  // Public
  impact(): Observable<ImpactDto> { return this.http.get<ImpactDto>('/api/public/impact'); }
  publicListings(): Observable<PublicListingDto[]> { return this.http.get<PublicListingDto[]>('/api/public/listings'); }
  rates(): Observable<RatesDto> { return this.http.get<RatesDto>('/api/meta/rates'); }

  // Admin
  adminCompanies(status?: string): Observable<CompanyDto[]> { return this.http.get<CompanyDto[]>('/api/admin/companies', { params: this.params({ status }) }); }
  approveCompany(id: string): Observable<CompanyDto> { return this.http.post<CompanyDto>(`/api/admin/companies/${id}/approve`, {}); }
  rejectCompany(id: string, reason: string): Observable<CompanyDto> { return this.http.post<CompanyDto>(`/api/admin/companies/${id}/reject`, { reason }); }

  // Companies
  myCompany(): Observable<CompanyDto> { return this.http.get<CompanyDto>('/api/companies/me'); }
  myTrust(): Observable<TrustDto> { return this.http.get<TrustDto>('/api/companies/me/trust'); }
  trustOf(id: string): Observable<TrustDto> { return this.http.get<TrustDto>(`/api/companies/${id}/trust`); }
  directory(role: 'EMITTER' | 'UTILIZER'): Observable<DirectoryEntry[]> { return this.http.get<DirectoryEntry[]>('/api/companies/directory', { params: this.params({ role }) }); }

  // Passports
  passports(): Observable<PassportDto[]> { return this.http.get<PassportDto[]>('/api/passports'); }
  passport(id: string): Observable<PassportDto> { return this.http.get<PassportDto>(`/api/passports/${id}`); }
  passportPublic(id: string): Observable<PassportPublicDto> { return this.http.get<PassportPublicDto>(`/api/passports/${id}/public`); }
  createPassport(body: Partial<PassportDto>): Observable<PassportDto> { return this.http.post<PassportDto>('/api/passports', body); }
  updatePassport(id: string, body: Partial<PassportDto>): Observable<PassportDto> { return this.http.put<PassportDto>(`/api/passports/${id}`, body); }
  allocation(id: string): Observable<AllocationDto> { return this.http.get<AllocationDto>(`/api/passports/${id}/allocation`); }
  forecasts(id: string): Observable<ForecastDto[]> { return this.http.get<ForecastDto[]>(`/api/passports/${id}/forecasts`); }
  createForecast(id: string, body: { periodStart: string; periodEnd: string; expectedTonnesPerDay: number; reason: string }): Observable<ForecastDto> {
    return this.http.post<ForecastDto>(`/api/passports/${id}/forecasts`, body);
  }

  // Listings
  createListing(body: CreateListingRequest): Observable<ListingDto> { return this.http.post<ListingDto>('/api/listings', body); }
  listings(f?: { mode?: string; status?: string; minPurity?: number; state?: string }): Observable<ListingDto[]> {
    return this.http.get<ListingDto[]>('/api/listings', { params: this.params(f) });
  }
  myListings(): Observable<ListingDto[]> { return this.http.get<ListingDto[]>('/api/listings/mine'); }
  listing(id: string): Observable<ListingDto> { return this.http.get<ListingDto>(`/api/listings/${id}`); }
  cancelListing(id: string): Observable<ListingDto> { return this.http.post<ListingDto>(`/api/listings/${id}/cancel`, {}); }
  submitProposal(listingId: string, body: CreateProposalRequest): Observable<ProposalDto> { return this.http.post<ProposalDto>(`/api/listings/${listingId}/proposals`, body); }
  listingProposals(listingId: string): Observable<ProposalDto[]> { return this.http.get<ProposalDto[]>(`/api/listings/${listingId}/proposals`); }
  award(listingId: string, proposalId: string): Observable<AgreementDto> { return this.http.post<AgreementDto>(`/api/listings/${listingId}/award`, { proposalId }); }

  // Proposals
  myProposals(): Observable<ProposalDto[]> { return this.http.get<ProposalDto[]>('/api/proposals/mine'); }
  withdrawProposal(id: string): Observable<ProposalDto> { return this.http.post<ProposalDto>(`/api/proposals/${id}/withdraw`, {}); }

  // Costs
  estimate(body: CostEstimateRequest): Observable<CostEstimateDto> { return this.http.post<CostEstimateDto>('/api/costs/estimate', body); }

  // Agreements
  agreements(): Observable<AgreementDto[]> { return this.http.get<AgreementDto[]>('/api/agreements'); }
  agreement(id: string): Observable<AgreementDto> { return this.http.get<AgreementDto>(`/api/agreements/${id}`); }
  cancelAgreement(id: string, reason: string): Observable<AgreementDto> { return this.http.post<AgreementDto>(`/api/agreements/${id}/cancel`, { reason }); }
  completeAgreement(id: string): Observable<AgreementDto> { return this.http.post<AgreementDto>(`/api/agreements/${id}/complete`, {}); }
  agreementDocument(id: string): Observable<string> { return this.http.get(`/api/agreements/${id}/document`, { responseType: 'text' }); }
  renewAgreement(id: string): Observable<NegotiationDto> { return this.http.post<NegotiationDto>(`/api/agreements/${id}/renew`, {}); }
  createShipment(agreementId: string, body: CreateShipmentRequest): Observable<ShipmentDto> { return this.http.post<ShipmentDto>(`/api/agreements/${agreementId}/shipments`, body); }

  // Negotiations
  createNegotiation(body: CreateNegotiationRequest): Observable<NegotiationDto> { return this.http.post<NegotiationDto>('/api/negotiations', body); }
  negotiations(): Observable<NegotiationDto[]> { return this.http.get<NegotiationDto[]>('/api/negotiations'); }
  negotiation(id: string): Observable<NegotiationDto> { return this.http.get<NegotiationDto>(`/api/negotiations/${id}`); }
  counterOffer(id: string, body: ContractOfferInput): Observable<NegotiationDto> { return this.http.post<NegotiationDto>(`/api/negotiations/${id}/offers`, body); }
  acceptOffer(id: string, offerId: string): Observable<NegotiationDto> { return this.http.post<NegotiationDto>(`/api/negotiations/${id}/offers/${offerId}/accept`, {}); }
  rejectOffer(id: string, offerId: string): Observable<NegotiationDto> { return this.http.post<NegotiationDto>(`/api/negotiations/${id}/offers/${offerId}/reject`, {}); }

  // Shipments
  shipments(): Observable<ShipmentDto[]> { return this.http.get<ShipmentDto[]>('/api/shipments'); }
  shipment(id: string): Observable<ShipmentDto> { return this.http.get<ShipmentDto>(`/api/shipments/${id}`); }
  transportOffers(): Observable<TransportOfferDto[]> { return this.http.get<TransportOfferDto[]>('/api/shipments/offers'); }
  acceptTransportOffer(offerId: string, quotedPrice: number): Observable<TransportOfferDto> { return this.http.post<TransportOfferDto>(`/api/shipments/offers/${offerId}/accept`, { quotedPrice }); }
  rejectTransportOffer(offerId: string): Observable<TransportOfferDto> { return this.http.post<TransportOfferDto>(`/api/shipments/offers/${offerId}/reject`, {}); }
  loadShipment(id: string, body: LoadRequest): Observable<ShipmentDto> { return this.http.post<ShipmentDto>(`/api/shipments/${id}/load`, body); }
  deliverShipment(id: string, body: DeliverRequest): Observable<ShipmentDto> { return this.http.post<ShipmentDto>(`/api/shipments/${id}/deliver`, body); }

  // Verification
  verificationQueue(): Observable<VerificationRequestDto[]> { return this.http.get<VerificationRequestDto[]>('/api/verification/queue'); }
  verificationRequest(id: string): Observable<VerificationRequestDto> { return this.http.get<VerificationRequestDto>(`/api/verification/${id}`); }
  claimVerification(id: string): Observable<VerificationRequestDto> { return this.http.post<VerificationRequestDto>(`/api/verification/${id}/claim`, {}); }
  decideVerification(id: string, body: DecideRequest): Observable<VerificationRequestDto> { return this.http.post<VerificationRequestDto>(`/api/verification/${id}/decide`, body); }
  verificationExpiring(): Observable<PassportDto[]> { return this.http.get<PassportDto[]>('/api/verification/expiring'); }
  verificationHistory(): Observable<VerificationRequestDto[]> { return this.http.get<VerificationRequestDto[]>('/api/verification/history'); }

  // Regulator
  regulatorOverview(): Observable<RegulatorOverview> { return this.http.get<RegulatorOverview>('/api/regulator/overview'); }
  regulatorCompanies(): Observable<RegulatorCompanyRow[]> { return this.http.get<RegulatorCompanyRow[]>('/api/regulator/companies'); }
  regulatorCompany(id: string): Observable<RegulatorCompanyDetail> { return this.http.get<RegulatorCompanyDetail>(`/api/regulator/companies/${id}`); }

  // Notifications
  notifications(): Observable<NotificationDto[]> { return this.http.get<NotificationDto[]>('/api/notifications'); }
  markRead(id: string): Observable<void> { return this.http.post<void>(`/api/notifications/${id}/read`, {}); }
  markAllRead(): Observable<void> { return this.http.post<void>('/api/notifications/read-all', {}); }
  unreadCount(): Observable<{ count: number }> { return this.http.get<{ count: number }>('/api/notifications/unread-count'); }

  // Audit
  audit(page = 0, size = 50): Observable<Page<AuditEventDto>> { return this.http.get<Page<AuditEventDto>>('/api/audit', { params: this.params({ page, size }) }); }
}

export type { ContractOfferDto };
