export type Role = 'ADMIN' | 'EMITTER' | 'UTILIZER' | 'TRANSPORT' | 'LAB' | 'REGULATOR';
export type CompanyStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';
export type ListingMode = 'TENDER' | 'AUCTION' | 'CONTRACT';
export type ListingStatus = 'OPEN' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'AWARDED' | 'CLOSED' | 'CANCELLED';
export type AuctionFilter = 'live' | 'upcoming' | 'ended';
export type ProposalStatus = 'SUBMITTED' | 'AWARDED' | 'REJECTED' | 'WITHDRAWN';
export type AgreementStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type NegotiationStatus = 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED';
export type TransportMode = 'PIPELINE' | 'TRUCK' | 'RAIL';
export type ShipmentStatus = 'REQUESTED' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED' | 'FLAGGED';
export type TransportOfferStatus = 'NOTIFIED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type VerificationType = 'PASSPORT_COA' | 'SALE_APPROVAL';
export type VerificationStatus = 'QUEUED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
export type PricingStructure = 'FIXED' | 'INDEXED';

export const SECTORS = [
  'CEMENT', 'STEEL', 'POWER', 'REFINERY', 'CHEMICALS', 'FUEL_SYNTHESIS', 'BUILDING_MATERIALS',
  'GREENHOUSE', 'ALGAE', 'LOGISTICS', 'LAB', 'GOVERNMENT', 'OTHER',
] as const;
export const IMPURITIES = ['H2O', 'O2', 'NOx', 'SOx', 'H2S', 'CO', 'N2'] as const;
export const INDIAN_STATES = [
  'Gujarat', 'Odisha', 'Maharashtra', 'Tamil Nadu', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Rajasthan',
  'Madhya Pradesh', 'Chhattisgarh', 'Jharkhand', 'West Bengal', 'Uttar Pradesh', 'Punjab', 'Haryana', 'Delhi', 'Kerala', 'Other',
];

export interface ApiError { status: number; message: string; timestamp?: string; }

export interface AuthUser {
  id: string; email: string; fullName: string; role: Role;
  companyId: string; companyName: string; companyStatus: CompanyStatus;
}
export interface LoginResponse { token: string; user: AuthUser; }
export interface RegisterRequest {
  role: Role; companyName: string; email: string; password: string; fullName: string;
  contactPhone: string; address: string; city: string; state: string; country: string;
  latitude: number; longitude: number; sector: string; registrationNumber: string;
  roleProfile: Record<string, unknown>;
}
export interface RegisterResponse { companyId: string; status: CompanyStatus; }

export interface CompanyDto {
  id: string; name: string; role: Role; status: CompanyStatus; contactEmail: string; contactPhone: string;
  address: string; city: string; state: string; country: string; latitude: number; longitude: number;
  sector: string; registrationNumber: string; roleProfile?: Record<string, unknown>; rejectionReason?: string | null;
  createdAt: string; approvedAt?: string | null;
}
export interface DirectoryEntry { id: string; name: string; city: string; state: string; sector: string; tier: Tier; }

export interface TrustDto {
  companyId: string; companyName: string; tier: Tier; hiddenScore: number; totalAgreements: number;
  completedAgreements: number; cancellationsBeforeExpiry: number; cancellationRate: number; completionRate: number; formula: string;
  tonnesSold?: number; badgeBasis?: string;
}

export interface ImpactDto {
  totalCo2DivertedTonnes: number; tonnesUnderContract: number; activeClusters: number; verifiedPassports: number;
  activeListings: number; completedAgreements: number;
  byRegion: { region: string; tonnes: number }[]; bySector: { sector: string; tonnes: number }[];
}
export interface PublicListingDto {
  id: string; mode: ListingMode; volumeTonnes: number; minPurityPct: number; concentrationPct: number;
  physicalState: string; city: string; state: string; basePricePerTonne: number; closesAt: string;
}

export interface Certification { name: string; url: string; }
export interface PassportDto {
  id: string; passportCode: string; emitterId: string; emitterName?: string; source: string; carbonOrigin: string;
  captureTechnology: string; dailyTonnage: number; dailyTonnageMin: number; dailyTonnageMax: number;
  totalVolumeTonnes: number; allocatedTonnes: number; concentrationPct: number; physicalState: string;
  pressureBar: number; temperatureC: number; impurities: Record<string, number>; labCertificateStatus: string;
  issuingLabId?: string | null; issuingLabName?: string | null; coaIssuedAt?: string | null; coaExpiresAt?: string | null;
  captureTimestamp: string; meterId: string; locationName: string; latitude: number; longitude: number;
  availabilityStart: string; availabilityEnd: string; pipelineConnected: boolean; certifications?: Certification[] | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'; mrvStatus: 'ACTIVE' | 'INACTIVE';
  extraAttributes: Record<string, unknown>; createdAt: string; updatedAt?: string;
}
export type PassportPublicDto = Omit<PassportDto, 'totalVolumeTonnes' | 'allocatedTonnes' | 'meterId'> & {
  totalVolumeTonnes?: number; allocatedTonnes?: number; meterId?: string;
};
export interface AllocationDto {
  passportId: string; passportCode: string; totalVolumeTonnes: number; allocatedTonnes: number;
  allocatedTender: number; allocatedAuction: number; allocatedContract: number; freeTonnes: number;
  listings: { listingId: string; mode: ListingMode; status: ListingStatus; volumeTonnes: number }[];
  agreements: { agreementId: string; mode: ListingMode; status: AgreementStatus; volumeTonnes: number }[];
}
export interface ForecastDto {
  id: string; passportId: string; periodStart: string; periodEnd: string; expectedTonnesPerDay: number; reason: string; createdAt: string;
}

export interface ListingDto {
  id: string; passportId: string; passportCode: string; mode: ListingMode; status: ListingStatus; volumeTonnes: number;
  basePricePerTonne: number; minPurityPct: number; concentrationPct: number; physicalState: string; carbonOrigin: string;
  captureTechnology: string; city: string; state: string; latitude: number; longitude: number; pipelineConnected: boolean;
  deliveryWindowStart: string; deliveryWindowEnd: string; closesAt: string; description: string;
  reservePricePerTonne?: number | null; emitterId?: string | null; emitterName?: string | null; emitterTier?: Tier | null;
  passportTotalVolume?: number | null; proposalCount: number; createdAt: string;
  // v2 — tender delivery schedule
  deliveryMonths?: number | null; monthlyTonnes?: number | null;
  // v2 — auction scheduling
  bidIncrement?: number | null; scheduledStartAt?: string | null; durationMinutes?: number | null;
  currentPricePerTonne?: number | null; bidCount?: number | null;
}
export interface CreateListingRequest {
  passportId: string; mode: ListingMode; volumeTonnes: number; basePricePerTonne: number; minPurityPct: number;
  deliveryWindowStart: string; deliveryWindowEnd: string; closesAt?: string | null; description: string;
  deliveryMonths?: number | null; monthlyTonnes?: number | null;
  bidIncrement?: number | null; scheduledStartAt?: string | null; durationMinutes?: number | null;
}

export interface ScoreComponent {
  name: string; rawValue: string | number | boolean; normalized: number; weight: number; contribution: number; explanation: string;
}
export interface ScoreBreakdown { mode: ListingMode; total: number; components: ScoreComponent[]; }
export interface ProposalDto {
  id: string; listingId: string; listingMode: ListingMode; utilizerId: string; utilizerName: string; utilizerTier: Tier;
  quantityTonnes: number; requiredPurityPct: number; durationMonths: number; deliveryRequirement: string;
  offeredPricePerTonne: number; acceptsEscrow: boolean; otherRequirements: string; status: ProposalStatus;
  score: number; scoreBreakdown: ScoreBreakdown; rank?: number | null; recommendation?: string | null; createdAt: string;
}
export interface CreateProposalRequest {
  quantityTonnes: number; requiredPurityPct: number; durationMonths: number; deliveryRequirement: string;
  offeredPricePerTonne: number; acceptsEscrow: boolean; otherRequirements: string;
}

/** v2 — profit-optimal multi-award. Exact knapsack on the server; nothing predictive. */
export interface AwardOption {
  label?: string; proposalIds: string[]; totalRevenue: number; totalTonnes: number;
  leftoverTonnes: number; utilizers?: string[];
}
export interface ProposalRevenueRow {
  proposalId: string; utilizerId?: string; utilizerName: string; tier: Tier; quantityTonnes: number;
  offeredPricePerTonne: number; revenue: number; inRecommendation: boolean; score: number; scoreBreakdown: ScoreBreakdown;
}
export interface AwardSuggestionDto {
  listingId: string; capacityTonnes: number; exact: boolean;
  recommended: AwardOption; alternatives: AwardOption[]; explanation: string; perProposal: ProposalRevenueRow[];
}

/** v2 — live ascending auction. */
export interface AuctionBidder { companyId?: string | null; displayName: string; tier: Tier; isYou: boolean; }
export interface AuctionBidDto {
  displayName: string; tier: Tier; amountPerTonne: number; totalAmount: number;
  placedAt: string; isYou: boolean; companyId?: string | null;
}
export interface AuctionStateDto {
  listingId: string; passportId: string; passportCode: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'AWARDED' | 'CLOSED' | 'CANCELLED';
  scheduledStartAt: string; closesAt: string; serverTime: string; secondsRemaining: number;
  basePricePerTonne: number; bidIncrement: number; currentPricePerTonne?: number | null; nextBidPricePerTonne: number;
  volumeTonnes: number; currentTotal?: number | null;
  leader?: AuctionBidder | null; bidCount: number; youAreLeading: boolean;
  canBid: boolean; blockedReason?: string | null; bindingTerms: string;
  emitterId?: string | null; emitterName?: string | null; emitterTier?: Tier | null;
  city: string; state: string; concentrationPct: number; agreementId?: string | null;
  bids: AuctionBidDto[];
}

export interface CostLayer { name: string; amount: number; perTonne: number; detail: string; }
export interface PurificationStep { parameter: string; passportLevel: number; requiredLevel: number; ratePerTonne: number; cost: number; }
export interface CarbonOutcome {
  grossTonnes: number; expectedLeakagePct: number; leakageLossTonnes: number; effectiveDeliveredTonnes: number;
  transportEmissionsTonnes: number; netCarbonBenefitTonnes: number;
}
export interface CostEstimateDto {
  listingId: string; quantityTonnes: number; distanceKm: number; transportMode: TransportMode; layers: CostLayer[];
  purificationSteps: PurificationStep[]; totalDeliveredCost: number; totalPerTonne: number; carbon: CarbonOutcome;
}
export interface CostEstimateRequest {
  listingId: string; quantityTonnes: number; requiredPurityPct: number; transportMode: TransportMode;
  impurityLimits?: Record<string, number>; destinationLatitude?: number; destinationLongitude?: number;
}

export interface AgreementDto {
  id: string; mode: ListingMode; status: AgreementStatus; listingId?: string | null; proposalId?: string | null;
  negotiationId?: string | null; passportId: string; passportCode: string; emitterId: string; emitterName: string;
  utilizerId: string; utilizerName: string; volumeTonnes: number; pricePerTonne: number; totalValue: number;
  startsAt: string; endsAt: string; durationMonths?: number | null; volumePerMonth?: number | null; depositPct?: number | null;
  takeOrPay?: boolean | null; supplyGapThresholdPct?: number | null; pricingStructure?: PricingStructure | null;
  costStack?: CostEstimateDto | null; cancelReason?: string | null; cancelledByCompanyId?: string | null; createdAt: string;
}

export interface ContractOfferInput {
  pricePerTonne: number; volumePerMonth: number; durationMonths: number; pricingStructure: PricingStructure;
  takeOrPay: boolean; supplyGapThresholdPct: number; depositPct: number; message: string;
}
export interface ContractOfferDto extends ContractOfferInput {
  id: string; version: number; proposedByCompanyId: string; proposedByName: string; status: OfferStatus; createdAt: string;
}
export interface NegotiationDto {
  id: string; passportId: string; passportCode: string; emitterId: string; emitterName: string; utilizerId: string;
  utilizerName: string; initiatedByCompanyId: string; status: NegotiationStatus; agreementId?: string | null;
  offers: ContractOfferDto[]; createdAt: string;
}
export interface CreateNegotiationRequest { counterpartyCompanyId: string; passportId: string; offer: ContractOfferInput; }

export interface ShipmentDto {
  id: string; agreementId: string; passportCode: string; emitterName: string; utilizerName: string;
  transportProviderId?: string | null; transportProviderName?: string | null; ownTransport: boolean; transportMode: TransportMode;
  status: ShipmentStatus; distanceKm: number; volumeTonnes: number; sealNumber?: string | null; loadedWeightTonnes?: number | null;
  loadMeterReading?: number | null; loadSamplePurityPct?: number | null; loadedAt?: string | null; deliverySealNumber?: string | null;
  deliveredWeightTonnes?: number | null; deliveryMeterReading?: number | null; deliverySamplePurityPct?: number | null;
  deliveredAt?: string | null; leakageTolerancePct: number; flags: string[]; transportCost?: number | null; createdAt: string;
}
export interface TransportOfferDto {
  id: string; shipmentId: string; shipment: ShipmentDto; status: TransportOfferStatus; distanceFromOriginKm: number;
  quotedPrice?: number | null; createdAt: string;
}
export interface CreateShipmentRequest { transportMode: TransportMode; ownTransport: boolean; volumeTonnes: number; }
export interface LoadRequest { sealNumber: string; loadedWeightTonnes: number; meterReading: number; samplePurityPct: number; }
export interface DeliverRequest { sealNumber: string; deliveredWeightTonnes: number; meterReading: number; samplePurityPct: number; }

export interface VerificationRequestDto {
  id: string; type: VerificationType; priority: number; status: VerificationStatus; passportId?: string | null;
  passportCode?: string | null; emitterName?: string | null; agreementId?: string | null; labId?: string | null;
  claimedSpecs?: Record<string, unknown> | null; measuredSpecs?: Record<string, unknown> | null; notes?: string | null;
  submittedAt: string; decidedAt?: string | null;
}
export interface DecideRequest {
  approved: boolean; measuredSpecs: { concentrationPct: number; impurities: Record<string, number> }; notes: string; coaValidMonths: number;
}

export interface RegulatorOverview {
  totals: { capturedTonnes: number; listedTonnes: number; tradedTonnes: number; utilizedTonnes: number };
  byRegion: { region: string; captured: number; traded: number }[];
  bySector: { sector: string; captured: number; traded: number }[];
  byMonth: { month: string; traded: number; utilized: number }[];
  flaggedShipments: number; expiredCoas: number;
}
export interface RegulatorCompanyRow {
  id: string; name: string; role: Role; sector: string; city: string; state: string; status: CompanyStatus; tier: Tier;
  hiddenScore: number; complianceFlags: string[]; incentiveFlags: string[]; verifiedPassports: number;
  totalAgreements: number; flaggedShipments: number;
}
export interface RegulatorCompanyDetail {
  company: CompanyDto; trust: TrustDto; passports: PassportDto[]; verificationRequests: VerificationRequestDto[];
  agreements: AgreementDto[]; shipments: ShipmentDto[]; complianceFlags: string[]; incentiveFlags: string[];
}

export interface NotificationDto {
  id: string; companyId: string; type: string; title: string; message: string; referenceType?: string | null;
  referenceId?: string | null; read: boolean; createdAt: string;
}

export interface AuditEventDto {
  id: number; occurredAt: string; actorCompanyId?: string | null; actorName?: string | null; actorRole?: string | null;
  action: string; entityType: string; entityId: string; details: Record<string, unknown>; previousHash: string; hash: string;
}
export interface Page<T> { content: T[]; totalElements: number; totalPages: number; number: number; }

export interface RatesDto { [key: string]: unknown; }
