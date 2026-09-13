package com.carbonmarket.seed;

import com.carbonmarket.config.AppProperties;
import com.carbonmarket.domain.*;
import com.carbonmarket.common.GeoUtil;
import com.carbonmarket.repository.*;
import com.carbonmarket.scoring.CostCalculator;
import com.carbonmarket.scoring.ReconciliationRules;
import com.carbonmarket.service.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Deterministic demo data (fixed UUIDs). Idempotent: skips when the admin user already exists.
 * ID scheme: companies ...0001xx, users ...0002xx, passports ...000342-345, listings ...001001+,
 * proposals ...002001+, agreements ...003001+, negotiations ...004001, offers ...004101+, shipments ...005001+,
 * transport offers ...005101+, verification requests ...006001+, forecasts ...007001.
 */
@Component
public class DataSeeder implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    public static final String PASSWORD = "Password123!";

    private final AppProperties props;
    private final CompanyRepository companies;
    private final UserRepository users;
    private final PassportRepository passports;
    private final ListingRepository listings;
    private final ProposalRepository proposals;
    private final AgreementRepository agreements;
    private final NegotiationRepository negotiations;
    private final ContractOfferRepository offers;
    private final ShipmentRepository shipments;
    private final TransportOfferRepository transportOffers;
    private final VerificationRequestRepository verifications;
    private final OutputForecastRepository forecasts;
    private final AuctionBidRepository auctionBids;
    private final AuthService auth;
    private final TrustService trust;
    private final AuditService audit;
    private final NotificationService notifications;
    private final ListingService listingService;
    private final PassportService passportService;
    private final VerificationService verificationService;
    private final CostService costService;

    public DataSeeder(AppProperties props, CompanyRepository companies, UserRepository users, PassportRepository passports,
                      ListingRepository listings, ProposalRepository proposals, AgreementRepository agreements,
                      NegotiationRepository negotiations, ContractOfferRepository offers, ShipmentRepository shipments,
                      TransportOfferRepository transportOffers, VerificationRequestRepository verifications,
                      OutputForecastRepository forecasts, AuctionBidRepository auctionBids,
                      AuthService auth, TrustService trust, AuditService audit,
                      NotificationService notifications, ListingService listingService, PassportService passportService,
                      VerificationService verificationService, CostService costService) {
        this.props = props; this.companies = companies; this.users = users; this.passports = passports; this.listings = listings;
        this.proposals = proposals; this.agreements = agreements; this.negotiations = negotiations; this.offers = offers;
        this.shipments = shipments; this.transportOffers = transportOffers; this.verifications = verifications; this.forecasts = forecasts;
        this.auctionBids = auctionBids;
        this.auth = auth; this.trust = trust; this.audit = audit; this.notifications = notifications; this.listingService = listingService;
        this.passportService = passportService; this.verificationService = verificationService; this.costService = costService;
    }

    public static UUID id(int n) { return UUID.fromString(String.format("00000000-0000-0000-0000-%012d", n)); }

    // Companies
    public static final UUID ADMIN = id(101), CEMENT = id(102), STEEL = id(103), POWER = id(104), METHANOL = id(105),
            GREENHOUSE = id(106), ALGAE = id(107), CONCRETE = id(108), GUJTRANS = id(109), ODTRANS = id(110), LAB = id(111),
            REGULATOR = id(112), NEWCO = id(113);
    // Passports
    public static final UUID P342 = id(342), P343 = id(343), P344 = id(344), P345 = id(345);
    // Listings
    public static final UUID L1 = id(1001), L2 = id(1002), L3 = id(1003), L4 = id(1004), L5 = id(1005), L6 = id(1006);
    /** L7 = the two-winner tender showcase; L8 = auction starting shortly; L9 = finished auction. */
    public static final UUID L7 = id(1007), L8 = id(1008), L9 = id(1009);
    // Agreements
    public static final UUID A_L4_ALGAE = id(3001), A_CONTRACT = id(3002), A_COMPLETED = id(3003), A_PENDING = id(3004);
    public static final UUID NEG = id(4001), SHIP_DELIVERED = id(5001), SHIP_REQUESTED = id(5002);
    public static final UUID A_AUCTION = id(3005);
    /** Completed history, so emitter badges (banded on tonnes sold) have something to band on. */
    public static final UUID A_HIST_CEMENT_1 = id(3006), A_HIST_CEMENT_2 = id(3007), A_HIST_STEEL = id(3008), A_HIST_POWER = id(3009);

    // ---- Expanded demo set: extra regions, sectors and states so every role has enough to show ----
    public static final UUID VINDHYA = id(114), DECCANREF = id(115), UREA = id(116), MALWA = id(117),
            DECTRANS = id(118), COASTAL = id(119), QUICKFIX = id(120);
    public static final UUID P346 = id(346), P347 = id(347), P348 = id(348), P349 = id(349);
    public static final UUID L10 = id(1010), L11 = id(1011), L12 = id(1012), L13 = id(1013), L14 = id(1014), L15 = id(1015);

    @Override
    @Transactional
    public void run(String... args) {
        if (!props.isSeed()) return;
        if (users.existsByEmailIgnoreCase("admin@carbon.local")) {
            log.info("Seed data already present; skipping");
        } else {
            seed();
            log.info("Seeded demo data (password for all accounts: {})", PASSWORD);
        }
        int expired = verificationService.expireCoas();
        if (expired > 0) log.info("Expired {} COA(s) at startup", expired);
    }

    public void seed() {
        // ---- Companies & users ----
        company(ADMIN, "Carbon Marketplace Admin", Role.ADMIN, Sector.OTHER, "Gandhinagar", "Gujarat", 23.22, 72.65, "admin@carbon.local", "Platform Admin", CompanyStatus.APPROVED);
        company(CEMENT, "Saurashtra Cement Works", Role.EMITTER, Sector.CEMENT, "Porbandar", "Gujarat", 21.64, 69.61, "cement@carbon.local", "Rohan Mehta", CompanyStatus.APPROVED);
        company(STEEL, "Kalinga Steel Plant", Role.EMITTER, Sector.STEEL, "Angul", "Odisha", 20.84, 85.10, "steel@carbon.local", "Debasis Rout", CompanyStatus.APPROVED);
        company(POWER, "Kutch Thermal Power", Role.EMITTER, Sector.POWER, "Mundra", "Gujarat", 22.84, 69.72, "power@carbon.local", "Priya Nair", CompanyStatus.APPROVED);
        company(METHANOL, "Gujarat Methanol Synthesis", Role.UTILIZER, Sector.FUEL_SYNTHESIS, "Dahej", "Gujarat", 21.70, 72.57, "methanol@carbon.local", "Anil Shah", CompanyStatus.APPROVED);
        company(GREENHOUSE, "Sabarmati Agro Greenhouses", Role.UTILIZER, Sector.GREENHOUSE, "Ahmedabad", "Gujarat", 23.02, 72.57, "greenhouse@carbon.local", "Kavita Patel", CompanyStatus.APPROVED);
        company(ALGAE, "Bay of Bengal Algae Farms", Role.UTILIZER, Sector.ALGAE, "Paradip", "Odisha", 20.32, 86.61, "algae@carbon.local", "Sunil Mohanty", CompanyStatus.APPROVED);
        company(CONCRETE, "Carbonated Concrete Co", Role.UTILIZER, Sector.BUILDING_MATERIALS, "Rajkot", "Gujarat", 22.30, 70.80, "concrete@carbon.local", "Jay Trivedi", CompanyStatus.APPROVED);
        company(GUJTRANS, "Saurashtra Cryo Logistics", Role.TRANSPORT, Sector.LOGISTICS, "Jamnagar", "Gujarat", 22.47, 70.06, "gujtrans@carbon.local", "Hitesh Jadeja", CompanyStatus.APPROVED);
        company(ODTRANS, "East Coast Gas Carriers", Role.TRANSPORT, Sector.LOGISTICS, "Cuttack", "Odisha", 20.46, 85.88, "odtrans@carbon.local", "Manas Das", CompanyStatus.APPROVED);
        company(LAB, "National CO2 Testing Lab", Role.LAB, Sector.LAB, "Vadodara", "Gujarat", 22.31, 73.18, "lab@carbon.local", "Dr. Meera Iyer", CompanyStatus.APPROVED);
        company(REGULATOR, "NITI CCUS Oversight Cell", Role.REGULATOR, Sector.GOVERNMENT, "New Delhi", "Delhi", 28.61, 77.21, "regulator@carbon.local", "Policy Analyst", CompanyStatus.APPROVED);
        company(NEWCO, "Bharat Bio-CO2 Ltd", Role.EMITTER, Sector.CHEMICALS, "Surat", "Gujarat", 21.17, 72.83, "newco@carbon.local", "Nisha Desai", CompanyStatus.PENDING);

        // ---- Trust ----
        trust.set(METHANOL, 10, 8, 0);   // 80 → GOLD
        trust.set(GREENHOUSE, 4, 3, 1);  // 75-15=60 → SILVER
        trust.set(ALGAE, 12, 12, 0);     // 100 → DIAMOND
        trust.set(CONCRETE, 5, 2, 2);    // 40-30=10 → BRONZE
        trust.set(CEMENT, 8, 8, 0);
        trust.set(STEEL, 6, 5, 0);
        trust.set(POWER, 5, 5, 0);
        for (UUID c : List.of(ADMIN, GUJTRANS, ODTRANS, LAB, REGULATOR, NEWCO)) trust.getOrCreate(c);

        // ---- Passports ----
        Instant now = Instant.now();
        Co2Passport p342 = passport(P342, "CO2-IND-2026-000342", CEMENT, "Cement kiln flue gas", CarbonOrigin.PROCESS, "Amine capture (MEA)",
                22.0, 18.0, 25.0, 600, 96.8, PhysicalState.LIQUEFIED, 18.0, -25.0,
                imp(30, 120, 15, 8, 2, 10, 4000), "MTR-PBR-01", "Porbandar cement works, Gujarat", 21.64, 69.61, false,
                VerificationStatus.VERIFIED, LabCertificateStatus.ISSUED, now.minus(40, ChronoUnit.DAYS), now.plus(140, ChronoUnit.DAYS));
        Co2Passport p343 = passport(P343, "CO2-IND-2026-000343", STEEL, "Blast furnace gas", CarbonOrigin.FOSSIL, "Pressure-swing adsorption (PSA)",
                40.0, 35.0, 45.0, 900, 94.5, PhysicalState.GASEOUS, 8.0, 20.0,
                imp(200, 800, 40, 25, 5, 350, 9000), "MTR-ANG-07", "Angul steel plant, Odisha", 20.84, 85.10, false,
                VerificationStatus.VERIFIED, LabCertificateStatus.ISSUED, now.minus(60, ChronoUnit.DAYS), now.plus(120, ChronoUnit.DAYS));
        Co2Passport p344 = passport(P344, "CO2-IND-2026-000344", POWER, "Power plant flue gas", CarbonOrigin.FOSSIL, "Amine capture (advanced solvent)",
                60.0, 55.0, 65.0, 1500, 98.2, PhysicalState.LIQUEFIED, 20.0, -20.0,
                imp(20, 60, 10, 4, 1, 5, 1500), "MTR-MND-03", "Mundra thermal station, Gujarat", 22.84, 69.72, true,
                VerificationStatus.VERIFIED, LabCertificateStatus.ISSUED, now.minus(20, ChronoUnit.DAYS), now.plus(160, ChronoUnit.DAYS));
        Co2Passport p345 = passport(P345, "CO2-IND-2026-000345", CEMENT, "Cement kiln flue gas (line 2)", CarbonOrigin.PROCESS, "Amine capture (MEA)",
                15.0, 12.0, 18.0, 300, 95.1, PhysicalState.LIQUEFIED, 17.0, -24.0,
                imp(45, 150, 20, 12, 3, 14, 5000), "MTR-PBR-02", "Porbandar cement works, Gujarat", 21.64, 69.61, false,
                VerificationStatus.PENDING, LabCertificateStatus.PENDING, null, null);
        for (Co2Passport p : List.of(p342, p343, p344, p345)) {
            audit.record(p.getEmitterId(), Role.EMITTER, "PASSPORT_CREATED", "Passport", p.getId(), AuditService.details("code", p.getPassportCode(), "totalVolumeTonnes", p.getTotalVolumeTonnes()));
        }
        // COA history for the verified passports
        verification(id(6003), VerificationType.PASSPORT_COA, p342, null, 3, VerificationRequestStatus.APPROVED, LAB, "COA issued; measured 96.8% CO2", now.minus(41, ChronoUnit.DAYS), now.minus(40, ChronoUnit.DAYS));
        verification(id(6004), VerificationType.PASSPORT_COA, p343, null, 3, VerificationRequestStatus.APPROVED, LAB, "COA issued; measured 94.5% CO2", now.minus(61, ChronoUnit.DAYS), now.minus(60, ChronoUnit.DAYS));
        verification(id(6005), VerificationType.PASSPORT_COA, p344, null, 3, VerificationRequestStatus.APPROVED, LAB, "COA issued; measured 98.2% CO2", now.minus(21, ChronoUnit.DAYS), now.minus(20, ChronoUnit.DAYS));
        verification(id(6001), VerificationType.PASSPORT_COA, p345, null, 3, VerificationRequestStatus.QUEUED, null, null, now.minus(2, ChronoUnit.DAYS), null);
        notifications.notify(LAB, "VERIFICATION_QUEUED", "New passport awaiting COA", "CO2-IND-2026-000345 from Saurashtra Cement Works needs an independent Certificate of Analysis.", "VerificationRequest", id(6001));

        // ---- Listings ----
        LocalDate today = LocalDate.now();
        Listing l1 = listing(L1, p342, SaleMode.TENDER, ListingStatus.OPEN, 300, 4200, 95.0, null, today.plusDays(14), today.plusMonths(6), now.plus(10, ChronoUnit.DAYS),
                "Steady liquefied CO2 from kiln capture. Prefer 6–12 month offtake with monthly deliveries.", now.minus(5, ChronoUnit.DAYS));
        // Live right now: opened 10 minutes ago, 30 minutes left, rising 100 per bid.
        Listing l2 = auction(L2, p342, ListingStatus.LIVE, 50, 5000, 100, now.minus(10, ChronoUnit.MINUTES), 40,
                today.plusDays(3), today.plusDays(10), "Spot lot: 50 t, liquefied, collect within a week. Last bid wins.",
                now.minus(1, ChronoUnit.DAYS));
        Listing l3 = listing(L3, p344, SaleMode.TENDER, ListingStatus.OPEN, 800, 3800, 97.0, null, today.plusDays(30), today.plusMonths(12), now.plus(20, ChronoUnit.DAYS),
                "High-purity liquefied CO2, pipeline-connected site. Large volumes for fuel synthesis / chemicals.", now.minus(3, ChronoUnit.DAYS));
        Listing l4 = listing(L4, p343, SaleMode.TENDER, ListingStatus.AWARDED, 400, 3500, 93.0, null, today.minusMonths(2), today.plusMonths(10), now.minus(50, ChronoUnit.DAYS),
                "Gaseous CO2 for algae / greenhouse use near Angul.", now.minus(70, ChronoUnit.DAYS));
        Listing l5 = listing(L5, p342, SaleMode.TENDER, ListingStatus.AWARDED, 100, 4050, 95.0, null, today.plusDays(7), today.plusMonths(6), now.minus(1, ChronoUnit.DAYS),
                "Small tender for greenhouse enrichment.", now.minus(8, ChronoUnit.DAYS));
        Listing l6 = listing(L6, p342, SaleMode.TENDER, ListingStatus.CLOSED, 200, 4100, 95.0, null, today.minusMonths(4), today.minusMonths(1), now.minus(120, ChronoUnit.DAYS),
                "Completed tender (history).", now.minus(130, ChronoUnit.DAYS));
        // The multi-award showcase: two 500 t bids together beat the single 1000 t bid.
        Listing l7 = listing(L7, p343, SaleMode.TENDER, ListingStatus.OPEN, 1000, 4000, 93.0, null, today.plusDays(21), today.plusMonths(9), now.plus(12, ChronoUnit.DAYS),
                "1000 t released as a single tender. Split awards welcome - partial volumes will be considered together.", now.minus(2, ChronoUnit.DAYS));
        l7.setDeliveryMonths(6); l7.setMonthlyTonnes(166.67); listings.save(l7);
        // Starts in 5 minutes, so the scheduled -> live transition can be demonstrated on the spot.
        Listing l8 = auction(L8, p344, ListingStatus.SCHEDULED, 40, 3900, 50, now.plus(5, ChronoUnit.MINUTES), 30,
                today.plusDays(5), today.plusDays(20), "High-purity spot lot from a pipeline-connected site.", now.minus(6, ChronoUnit.HOURS));
        // Already finished, won on the last bid.
        Listing l9 = auction(L9, p343, ListingStatus.AWARDED, 60, 3400, 100, now.minus(3, ChronoUnit.DAYS), 60,
                today.minusDays(2), today.plusMonths(2), "Spot lot (closed).", now.minus(4, ChronoUnit.DAYS));
        l9.setCurrentPricePerTonne(3700.0); l9.setCurrentLeaderId(ALGAE); listings.save(l9);
        for (Listing l : List.of(l1, l2, l3, l4, l5, l6, l7, l8, l9)) {
            audit.record(l.getEmitterId(), Role.EMITTER, "LISTING_CREATED", "Listing", l.getId(), AuditService.details("mode", l.getMode().name(), "volumeTonnes", l.getVolumeTonnes(), "basePricePerTonne", l.getBasePricePerTonne()));
        }

        // ---- Proposals (scored with the real formula) ----
        proposal(id(2001), l1, p342, METHANOL, 250, 96.0, 12, "Monthly deliveries by cryogenic tanker", 4300, true, "ISO tank containers preferred", ProposalStatus.SUBMITTED, now.minus(4, ChronoUnit.DAYS));
        proposal(id(2002), l1, p342, GREENHOUSE, 100, 95.0, 6, "Fortnightly", 4000, false, null, ProposalStatus.SUBMITTED, now.minus(3, ChronoUnit.DAYS));
        proposal(id(2003), l1, p342, CONCRETE, 300, 95.0, 3, "Bulk, single delivery window", 4600, false, "Need delivery within 30 days", ProposalStatus.SUBMITTED, now.minus(2, ChronoUnit.DAYS));
        // L7: methanol 500 + algae 500 = 43,50,000 beats concrete's single 1000 t bid at 42,00,000.
        proposal(id(2010), l7, p343, METHANOL, 500, 93.0, 6, "Monthly by rail", 4400, true, null, ProposalStatus.SUBMITTED, now.minus(40, ChronoUnit.HOURS));
        proposal(id(2011), l7, p343, ALGAE, 500, 93.0, 6, "Monthly by road", 4300, true, null, ProposalStatus.SUBMITTED, now.minus(30, ChronoUnit.HOURS));
        proposal(id(2012), l7, p343, CONCRETE, 1000, 93.0, 6, "Single bulk lift", 4200, false, null, ProposalStatus.SUBMITTED, now.minus(20, ChronoUnit.HOURS));
        proposal(id(2006), l3, p344, ALGAE, 600, 97.0, 12, "Rail to Paradip", 3900, true, null, ProposalStatus.SUBMITTED, now.minus(1, ChronoUnit.DAYS));
        Proposal pr7 = proposal(id(2007), l4, p343, ALGAE, 350, 93.0, 12, "Truck, weekly", 3500, true, null, ProposalStatus.AWARDED, now.minus(60, ChronoUnit.DAYS));
        Proposal pr8 = proposal(id(2008), l5, p342, GREENHOUSE, 100, 95.0, 6, "Monthly", 4050, true, null, ProposalStatus.AWARDED, now.minus(3, ChronoUnit.DAYS));
        Proposal pr9 = proposal(id(2009), l6, p342, METHANOL, 200, 96.0, 3, "Monthly", 4100, true, null, ProposalStatus.AWARDED, now.minus(125, ChronoUnit.DAYS));
        notifications.notify(CEMENT, "PROPOSAL_RECEIVED", "New tender proposal on CO2-IND-2026-000342", "Carbonated Concrete Co (BRONZE) offers ₹4600/t for 300 t.", "Listing", L1);
        // Live auction ladder on L2: 5000 opening, then +100 a bid.
        bid(id(8001), L2, GREENHOUSE, 5000, 50, now.minus(8, ChronoUnit.MINUTES));
        bid(id(8002), L2, CONCRETE, 5100, 50, now.minus(6, ChronoUnit.MINUTES));
        bid(id(8003), L2, GREENHOUSE, 5200, 50, now.minus(4, ChronoUnit.MINUTES));
        l2.setCurrentPricePerTonne(5200.0); l2.setCurrentLeaderId(GREENHOUSE); listings.save(l2);
        notifications.notify(CEMENT, "BID_RECEIVED", "New bid on CO2-IND-2026-000342", "A bidder raised the auction to \u20b95200/t for 50 t.", "Listing", L2);
        notifications.notify(CONCRETE, "OUTBID", "You have been outbid on CO2-IND-2026-000342", "The bid is now \u20b95200/t. Bid \u20b95300/t to lead again.", "Listing", L2);
        // Finished auction on L9, won by the last bidder.
        bid(id(8004), L9, CONCRETE, 3400, 60, now.minus(3, ChronoUnit.DAYS).plus(5, ChronoUnit.MINUTES));
        bid(id(8005), L9, ALGAE, 3500, 60, now.minus(3, ChronoUnit.DAYS).plus(11, ChronoUnit.MINUTES));
        bid(id(8006), L9, CONCRETE, 3600, 60, now.minus(3, ChronoUnit.DAYS).plus(19, ChronoUnit.MINUTES));
        bid(id(8007), L9, ALGAE, 3700, 60, now.minus(3, ChronoUnit.DAYS).plus(25, ChronoUnit.MINUTES));
        notifications.notify(POWER, "PROPOSAL_RECEIVED", "New tender proposal on CO2-IND-2026-000344", "Bay of Bengal Algae Farms (DIAMOND) offers ₹3900/t for 600 t.", "Listing", L3);

        // ---- Agreements ----
        Agreement a1 = agreement(A_L4_ALGAE, l4, pr7, null, STEEL, ALGAE, p343, SaleMode.TENDER, 350, 3500, AgreementStatus.ACTIVE,
                today.minusMonths(2), today.plusMonths(10), 12, null, 10.0, false, 10.0, PricingStructure.FIXED, now.minus(58, ChronoUnit.DAYS));
        Agreement a3 = agreement(A_COMPLETED, l6, pr9, null, CEMENT, METHANOL, p342, SaleMode.TENDER, 200, 4100, AgreementStatus.COMPLETED,
                today.minusMonths(4), today.minusMonths(1), 3, null, 10.0, false, 10.0, PricingStructure.FIXED, now.minus(120, ChronoUnit.DAYS));
        Agreement a4 = agreement(A_PENDING, l5, pr8, null, CEMENT, GREENHOUSE, p342, SaleMode.TENDER, 100, 4050, AgreementStatus.PENDING_VERIFICATION,
                today.plusDays(7), today.plusMonths(6), 6, null, 10.0, false, 10.0, PricingStructure.FIXED, now.minus(1, ChronoUnit.DAYS));
        verification(id(6002), VerificationType.SALE_APPROVAL, p342, a4, 4, VerificationRequestStatus.QUEUED, null,
                "Sale approval: 100 t of CO2-IND-2026-000342 to Sabarmati Agro Greenhouses", now.minus(1, ChronoUnit.DAYS), null);
        notifications.notify(GREENHOUSE, "TENDER_AWARDED", "Tender awarded: CO2-IND-2026-000342", "Saurashtra Cement Works awarded you 100 t at ₹4050/t. The sale is queued for independent lab approval.", "Agreement", A_PENDING);
        notifications.notify(LAB, "VERIFICATION_QUEUED", "Sale awaiting lab approval", "Agreement on CO2-IND-2026-000342 needs approval before it becomes active.", "VerificationRequest", id(6002));
        audit.record(CEMENT, Role.EMITTER, "LISTING_AWARDED", "Listing", L5, AuditService.details("proposal", id(2008), "agreement", A_PENDING, "volumeTonnes", 100));
        audit.record(STEEL, Role.EMITTER, "LISTING_AWARDED", "Listing", L4, AuditService.details("proposal", id(2007), "agreement", A_L4_ALGAE, "volumeTonnes", 350, "releasedRemainderTonnes", 50));
        audit.record(LAB, Role.LAB, "VERIFICATION_APPROVED", "VerificationRequest", id(6006), AuditService.details("type", "SALE_APPROVAL", "agreement", A_L4_ALGAE));
        audit.record(METHANOL, Role.UTILIZER, "AGREEMENT_COMPLETED", "Agreement", A_COMPLETED, AuditService.details("volumeTonnes", 200));

        Agreement a5 = agreement(A_AUCTION, l9, null, null, STEEL, ALGAE, p343, SaleMode.AUCTION, 60, 3700, AgreementStatus.ACTIVE,
                today.minusDays(2), today.plusMonths(2), 1, null, 10.0, false, null, PricingStructure.FIXED, now.minus(3, ChronoUnit.DAYS));
        notifications.notify(ALGAE, "AUCTION_WON", "Auction won: CO2-IND-2026-000343", "You placed the last bid at \u20b93700/t for 60 t (\u20b92,22,000 total). This purchase is binding.", "Agreement", A_AUCTION);
        audit.record(STEEL, Role.EMITTER, "AUCTION_WON", "Listing", L9, AuditService.details("winner", ALGAE, "agreement", A_AUCTION, "finalPricePerTonne", 3700, "volumeTonnes", 60, "bidCount", 4));

        // ---- Negotiated contract: power ↔ methanol ----
        Negotiation n = new Negotiation();
        n.setId(NEG); n.setPassportId(P344); n.setEmitterId(POWER); n.setUtilizerId(METHANOL); n.setInitiatedByCompanyId(METHANOL);
        n.setStatus(NegotiationStatus.ACCEPTED); n.setAgreementId(A_CONTRACT); n.setCreatedAt(now.minus(15, ChronoUnit.DAYS));
        negotiations.save(n);
        offer(id(4101), n, 1, METHANOL, 3500, 40, 12, PricingStructure.FIXED, true, 10.0, 10.0, "Proposing 12-month fixed supply for our methanol line; happy to take-or-pay.", OfferStatus.COUNTERED, now.minus(15, ChronoUnit.DAYS));
        offer(id(4102), n, 2, POWER, 3600, 40, 12, PricingStructure.FIXED, true, 10.0, 10.0, "Counter at ₹3600/t reflecting liquefaction cost; otherwise agreed.", OfferStatus.ACCEPTED, now.minus(12, ChronoUnit.DAYS));
        Agreement a2 = agreement(A_CONTRACT, null, null, n, POWER, METHANOL, p344, SaleMode.CONTRACT, 480, 3600, AgreementStatus.ACTIVE,
                today.withDayOfMonth(1), today.withDayOfMonth(1).plusMonths(12), 12, 40.0, 10.0, true, 10.0, PricingStructure.FIXED, now.minus(12, ChronoUnit.DAYS));
        audit.record(METHANOL, Role.UTILIZER, "NEGOTIATION_OPENED", "Negotiation", NEG, AuditService.details("passport", "CO2-IND-2026-000344", "pricePerTonne", 3500));
        audit.record(POWER, Role.EMITTER, "OFFER_COUNTERED", "Negotiation", NEG, AuditService.details("version", 2, "pricePerTonne", 3600));
        audit.record(METHANOL, Role.UTILIZER, "CONTRACT_SIGNED", "Agreement", A_CONTRACT, AuditService.details("negotiation", NEG, "lockedTonnes", 480, "pricePerTonne", 3600));
        notifications.notify(POWER, "CONTRACT_SIGNED", "Contract accepted", "Gujarat Methanol Synthesis accepted offer v2: 40 t/month × 12 months at ₹3600/t. 480 t locked on CO2-IND-2026-000344. Deposit 10% due at signing.", "Agreement", A_CONTRACT);

        // ---- Completed history (drives the emitter badge, which is banded on tonnes sold) ----
        // These are finished deals: the volume was consumed long ago, so they hold no allocation.
        agreement(A_HIST_CEMENT_1, null, null, null, CEMENT, METHANOL, p342, SaleMode.TENDER, 1200, 3950, AgreementStatus.COMPLETED,
                today.minusMonths(14), today.minusMonths(8), 6, null, 10.0, false, null, PricingStructure.FIXED, now.minus(430, ChronoUnit.DAYS));
        agreement(A_HIST_CEMENT_2, null, null, null, CEMENT, CONCRETE, p342, SaleMode.TENDER, 900, 4050, AgreementStatus.COMPLETED,
                today.minusMonths(9), today.minusMonths(5), 4, null, 10.0, false, null, PricingStructure.FIXED, now.minus(280, ChronoUnit.DAYS));
        agreement(A_HIST_STEEL, null, null, null, STEEL, ALGAE, p343, SaleMode.TENDER, 1300, 3450, AgreementStatus.COMPLETED,
                today.minusMonths(11), today.minusMonths(6), 5, null, 10.0, false, null, PricingStructure.FIXED, now.minus(340, ChronoUnit.DAYS));
        agreement(A_HIST_POWER, null, null, null, POWER, METHANOL, p344, SaleMode.CONTRACT, 4600, 3550, AgreementStatus.COMPLETED,
                today.minusMonths(18), today.minusMonths(6), 12, 383.33, 10.0, true, 10.0, PricingStructure.FIXED, now.minus(560, ChronoUnit.DAYS));

        // ---- Passport allocations (consistent with the above) ----
        // 342: L1 300 + L2 50 + pending agreement 100 = 450 locked; completed 200 t already consumed from stock.
        p342.setAllocatedTonnes(450); passports.save(p342);
        // 343: active agreement 350 + L7 tender 1000 + auction agreement 60 = 1410 of 1900
        p343.setTotalVolumeTonnes(1900);
        p343.setAllocatedTonnes(1410); passports.save(p343);
        // 344: L3 800 + contract 480 + scheduled auction 40 = 1320 of 1500
        p344.setAllocatedTonnes(1320); passports.save(p344);

        // ---- Shipments on the active steel → algae agreement ----
        double dist = GeoUtil.distanceKm(20.84, 85.10, 20.32, 86.61);
        Shipment s1 = new Shipment();
        s1.setId(SHIP_DELIVERED); s1.setAgreementId(A_L4_ALGAE); s1.setTransportProviderId(ODTRANS); s1.setOwnTransport(false);
        s1.setTransportMode(TransportMode.TRUCK); s1.setDistanceKm(dist); s1.setVolumeTonnes(35);
        s1.setOriginLat(20.84); s1.setOriginLng(85.10); s1.setDestLat(20.32); s1.setDestLng(86.61);
        s1.setSealNumber("SEAL-7781"); s1.setLoadedWeightTonnes(35.0); s1.setLoadMeterReading(120450.0); s1.setLoadSamplePurityPct(94.5); s1.setLoadedAt(now.minus(20, ChronoUnit.DAYS));
        s1.setDeliverySealNumber("SEAL-7781"); s1.setDeliveredWeightTonnes(34.6); s1.setDeliveryMeterReading(120485.0); s1.setDeliverySamplePurityPct(94.4); s1.setDeliveredAt(now.minus(19, ChronoUnit.DAYS));
        s1.setFlags(ReconciliationRules.evaluate(new ReconciliationRules.Input("SEAL-7781", "SEAL-7781", 35.0, 34.6, 94.5, 94.4, 120450.0, 120485.0, 2.0)));
        s1.setStatus(s1.getFlags().isEmpty() ? ShipmentStatus.DELIVERED : ShipmentStatus.FLAGGED);
        s1.setTransportCost(dist * 35 * 4.0 + 5000); s1.setCreatedAt(now.minus(22, ChronoUnit.DAYS));
        shipments.save(s1);
        TransportOffer to1 = new TransportOffer();
        to1.setId(id(5102)); to1.setShipmentId(SHIP_DELIVERED); to1.setProviderId(ODTRANS); to1.setStatus(TransportOfferStatus.ACCEPTED);
        to1.setDistanceFromOriginKm(GeoUtil.distanceKm(20.84, 85.10, 20.46, 85.88)); to1.setQuotedPrice(s1.getTransportCost()); to1.setCreatedAt(now.minus(22, ChronoUnit.DAYS));
        transportOffers.save(to1);
        audit.record(STEEL, Role.EMITTER, "SHIPMENT_REQUESTED", "Shipment", SHIP_DELIVERED, AuditService.details("agreement", A_L4_ALGAE, "volumeTonnes", 35, "mode", "TRUCK"));
        audit.record(ODTRANS, Role.TRANSPORT, "TRANSPORT_ACCEPTED", "Shipment", SHIP_DELIVERED, AuditService.details("provider", ODTRANS));
        audit.record(STEEL, Role.EMITTER, "SHIPMENT_LOADED", "Shipment", SHIP_DELIVERED, AuditService.details("seal", "SEAL-7781", "loadedWeightTonnes", 35.0));
        audit.record(ALGAE, Role.UTILIZER, "SHIPMENT_DELIVERED", "Shipment", SHIP_DELIVERED, AuditService.details("deliverySeal", "SEAL-7781", "deliveredWeightTonnes", 34.6, "flags", List.of()));

        Shipment s2 = new Shipment();
        s2.setId(SHIP_REQUESTED); s2.setAgreementId(A_L4_ALGAE); s2.setOwnTransport(false); s2.setTransportMode(TransportMode.TRUCK);
        s2.setStatus(ShipmentStatus.REQUESTED); s2.setDistanceKm(dist); s2.setVolumeTonnes(35);
        s2.setOriginLat(20.84); s2.setOriginLng(85.10); s2.setDestLat(20.32); s2.setDestLng(86.61);
        s2.setTransportCost(dist * 35 * 4.0 + 5000); s2.setCreatedAt(now.minus(1, ChronoUnit.DAYS));
        shipments.save(s2);
        TransportOffer to2 = new TransportOffer();
        to2.setId(id(5101)); to2.setShipmentId(SHIP_REQUESTED); to2.setProviderId(ODTRANS); to2.setStatus(TransportOfferStatus.NOTIFIED);
        to2.setDistanceFromOriginKm(GeoUtil.distanceKm(20.84, 85.10, 20.46, 85.88)); to2.setCreatedAt(now.minus(1, ChronoUnit.DAYS));
        transportOffers.save(to2);
        notifications.notify(ODTRANS, "TRANSPORT_REQUEST", "Shipment request near you",
                String.format("35 t of GASEOUS CO2 by TRUCK, Angul steel plant, Odisha → Paradip (%.0f km). Estimated ₹%.0f. Accept or reject.", dist, s2.getTransportCost()), "Shipment", SHIP_REQUESTED);
        audit.record(STEEL, Role.EMITTER, "SHIPMENT_REQUESTED", "Shipment", SHIP_REQUESTED, AuditService.details("agreement", A_L4_ALGAE, "volumeTonnes", 35, "mode", "TRUCK", "providersNotified", 1));

        // ---- Gujarat lane: work for Saurashtra Cryo Logistics -------------------------------
        // (transportOffer(...) helper is defined at the bottom of this class)
        // Without these the second carrier signs in to an empty portal, and the reconciliation
        // flags never appear anywhere in the seed.
        double gujDist = GeoUtil.distanceKm(22.84, 69.72, 21.70, 72.57);   // Mundra → Dahej
        double gujHop = GeoUtil.distanceKm(22.84, 69.72, 22.47, 70.06);    // Mundra → Jamnagar depot

        // In transit right now: loaded and sealed, not yet delivered.
        Shipment s3 = new Shipment();
        s3.setId(id(5003)); s3.setAgreementId(A_CONTRACT); s3.setTransportProviderId(GUJTRANS); s3.setOwnTransport(false);
        s3.setTransportMode(TransportMode.TRUCK); s3.setDistanceKm(gujDist); s3.setVolumeTonnes(40);
        s3.setOriginLat(22.84); s3.setOriginLng(69.72); s3.setDestLat(21.70); s3.setDestLng(72.57);
        s3.setSealNumber("SEAL-8420"); s3.setLoadedWeightTonnes(40.0); s3.setLoadMeterReading(88120.0);
        s3.setLoadSamplePurityPct(98.2); s3.setLoadedAt(now.minus(2, ChronoUnit.DAYS));
        s3.setStatus(ShipmentStatus.IN_TRANSIT);
        s3.setTransportCost(gujDist * 40 * 4.0 + 5000); s3.setCreatedAt(now.minus(3, ChronoUnit.DAYS));
        shipments.save(s3);
        transportOffer(id(5103), id(5003), GUJTRANS, TransportOfferStatus.ACCEPTED, gujHop, s3.getTransportCost(), now.minus(3, ChronoUnit.DAYS));
        audit.record(POWER, Role.EMITTER, "SHIPMENT_REQUESTED", "Shipment", id(5003), AuditService.details("agreement", A_CONTRACT, "volumeTonnes", 40, "mode", "TRUCK"));
        audit.record(GUJTRANS, Role.TRANSPORT, "TRANSPORT_ACCEPTED", "Shipment", id(5003), AuditService.details("provider", GUJTRANS));
        audit.record(POWER, Role.EMITTER, "SHIPMENT_LOADED", "Shipment", id(5003), AuditService.details("seal", "SEAL-8420", "loadedWeightTonnes", 40.0));

        // Delivered but flagged: the delivery seal does not match and 1.8 t went missing.
        // Flags come from the real rules, not a hardcoded list.
        Shipment s4 = new Shipment();
        s4.setId(id(5004)); s4.setAgreementId(A_CONTRACT); s4.setTransportProviderId(GUJTRANS); s4.setOwnTransport(false);
        s4.setTransportMode(TransportMode.TRUCK); s4.setDistanceKm(gujDist); s4.setVolumeTonnes(40);
        s4.setOriginLat(22.84); s4.setOriginLng(69.72); s4.setDestLat(21.70); s4.setDestLng(72.57);
        s4.setSealNumber("SEAL-8310"); s4.setLoadedWeightTonnes(40.0); s4.setLoadMeterReading(87680.0);
        s4.setLoadSamplePurityPct(98.2); s4.setLoadedAt(now.minus(13, ChronoUnit.DAYS));
        s4.setDeliverySealNumber("SEAL-8317"); s4.setDeliveredWeightTonnes(38.2); s4.setDeliveryMeterReading(87720.0);
        s4.setDeliverySamplePurityPct(98.1); s4.setDeliveredAt(now.minus(12, ChronoUnit.DAYS));
        s4.setFlags(ReconciliationRules.evaluate(new ReconciliationRules.Input(
                "SEAL-8310", "SEAL-8317", 40.0, 38.2, 98.2, 98.1, 87680.0, 87720.0, 2.0)));
        s4.setStatus(s4.getFlags().isEmpty() ? ShipmentStatus.DELIVERED : ShipmentStatus.FLAGGED);
        s4.setTransportCost(gujDist * 40 * 4.0 + 5000); s4.setCreatedAt(now.minus(14, ChronoUnit.DAYS));
        shipments.save(s4);
        transportOffer(id(5104), id(5004), GUJTRANS, TransportOfferStatus.ACCEPTED, gujHop, s4.getTransportCost(), now.minus(14, ChronoUnit.DAYS));
        audit.record(GUJTRANS, Role.TRANSPORT, "TRANSPORT_ACCEPTED", "Shipment", id(5004), AuditService.details("provider", GUJTRANS));
        audit.record(METHANOL, Role.UTILIZER, "SHIPMENT_FLAGGED", "Shipment", id(5004),
                AuditService.details("deliverySeal", "SEAL-8317", "deliveredWeightTonnes", 38.2, "flags", s4.getFlags()));
        notifications.notify(POWER, "SHIPMENT_FLAGGED", "Shipment flagged on delivery",
                "SEAL-8310 left Mundra but SEAL-8317 arrived at Dahej, and 1.8 t of 40 t is unaccounted for. Reconciliation failed on seal and weight.", "Shipment", id(5004));
        notifications.notify(GUJTRANS, "SHIPMENT_FLAGGED", "Your delivery was flagged",
                "Seal mismatch and a 4.5% weight gap on the Mundra → Dahej run. The lab has been notified.", "Shipment", id(5004));

        // Waiting for a carrier: both Gujarat-side providers were notified.
        Shipment s5 = new Shipment();
        s5.setId(id(5005)); s5.setAgreementId(A_CONTRACT); s5.setOwnTransport(false); s5.setTransportMode(TransportMode.RAIL);
        s5.setStatus(ShipmentStatus.REQUESTED); s5.setDistanceKm(gujDist); s5.setVolumeTonnes(40);
        s5.setOriginLat(22.84); s5.setOriginLng(69.72); s5.setDestLat(21.70); s5.setDestLng(72.57);
        s5.setTransportCost(gujDist * 40 * 2.5 + 15000); s5.setCreatedAt(now.minus(6, ChronoUnit.HOURS));
        shipments.save(s5);
        transportOffer(id(5105), id(5005), GUJTRANS, TransportOfferStatus.NOTIFIED, gujHop, null, now.minus(6, ChronoUnit.HOURS));
        transportOffer(id(5106), id(5005), ODTRANS, TransportOfferStatus.NOTIFIED,
                GeoUtil.distanceKm(22.84, 69.72, 20.46, 85.88), null, now.minus(6, ChronoUnit.HOURS));
        notifications.notify(GUJTRANS, "TRANSPORT_REQUEST", "Shipment request near you",
                String.format("40 t of LIQUEFIED CO2 by RAIL, Mundra → Dahej (%.0f km). Estimated ₹%.0f. Accept or reject.", gujDist, s5.getTransportCost()), "Shipment", id(5005));
        audit.record(POWER, Role.EMITTER, "SHIPMENT_REQUESTED", "Shipment", id(5005),
                AuditService.details("agreement", A_CONTRACT, "volumeTonnes", 40, "mode", "RAIL", "providersNotified", 2));

        // A job this carrier turned down, so the portal shows more than one outcome.
        transportOffer(id(5107), SHIP_REQUESTED, GUJTRANS, TransportOfferStatus.REJECTED,
                GeoUtil.distanceKm(20.84, 85.10, 22.47, 70.06), null, now.minus(1, ChronoUnit.DAYS));


        // ---- Forecast shortfall on 344 (contract with methanol is active) ----
        OutputForecast f = new OutputForecast();
        f.setId(id(7001)); f.setPassportId(P344); f.setPeriodStart(today.plusMonths(1)); f.setPeriodEnd(today.plusMonths(1).plusDays(10));
        f.setExpectedTonnesPerDay(30); f.setReason("Planned boiler maintenance outage");
        forecasts.save(f);
        int notified = passportService.notifyShortfall(f, p344);
        audit.record(POWER, Role.EMITTER, "FORECAST_ADDED", "Passport", P344, AuditService.details("expectedTonnesPerDay", 30, "utilizersNotified", notified));

        // Emitter badges are banded on cumulative tonnes sold, so re-read them now the agreements exist:
        // cement 2300 t GOLD, steel 1710 t SILVER, power 5080 t DIAMOND.
        trust.refreshBadge(CEMENT, STEEL, POWER);

        // ---- Pending sign-up notification for admin ----
        notifications.notify(ADMIN, "SIGNUP_PENDING", "New sign-up awaiting verification", "Bharat Bio-CO2 Ltd registered as EMITTER. Verify the company (form review + call/visit) before approving.", "Company", NEWCO);
        audit.record(NEWCO, Role.EMITTER, "COMPANY_REGISTERED", "Company", NEWCO, AuditService.details("name", "Bharat Bio-CO2 Ltd", "role", "EMITTER"));

        seedExpandedDemoSet(now, today);
    }

    // =====================================================================================
    // Expanded demo set
    // -------------------------------------------------------------------------------------
    // Self-contained block added on top of the original seed. It widens the data so every
    // role has something worth showing: more states and sectors for the regulator charts,
    // a second pending sign-up and a rejected one for the admin queue, an expired COA and a
    // deeper lab queue, more competing proposals, a fuller year of agreement history, and
    // enough shipment states for all three carriers.
    // =====================================================================================
    private void seedExpandedDemoSet(Instant now, LocalDate today) {
        // ---- Companies: new states (MP, AP, Maharashtra, Telangana, Karnataka, UP) ----
        company(VINDHYA, "Vindhya Cement Industries", Role.EMITTER, Sector.CEMENT, "Satna", "Madhya Pradesh", 24.57, 80.83, "vindhya@carbon.local", "Arjun Sharma", CompanyStatus.APPROVED);
        company(DECCANREF, "Deccan Refining Company", Role.EMITTER, Sector.REFINERY, "Visakhapatnam", "Andhra Pradesh", 17.69, 83.22, "deccanref@carbon.local", "Lakshmi Rao", CompanyStatus.APPROVED);
        company(UREA, "Konkan Urea Works", Role.UTILIZER, Sector.CHEMICALS, "Ratnagiri", "Maharashtra", 16.99, 73.30, "urea@carbon.local", "Pradeep Kulkarni", CompanyStatus.APPROVED);
        company(MALWA, "Malwa Protected Cultivation", Role.UTILIZER, Sector.GREENHOUSE, "Indore", "Madhya Pradesh", 22.72, 75.86, "malwa@carbon.local", "Sneha Joshi", CompanyStatus.APPROVED);
        company(DECTRANS, "Deccan Cryo Roadways", Role.TRANSPORT, Sector.LOGISTICS, "Hyderabad", "Telangana", 17.38, 78.49, "dectrans@carbon.local", "Ravi Reddy", CompanyStatus.APPROVED);
        // A second sign-up waiting on the admin, so the approvals queue is not a single row.
        company(COASTAL, "Coastal Carbon Recovery", Role.EMITTER, Sector.CHEMICALS, "Mangaluru", "Karnataka", 12.91, 74.86, "coastal@carbon.local", "Girish Pai", CompanyStatus.PENDING);
        // A rejected application, so that state is visible somewhere. Invented company.
        company(QUICKFIX, "Quickfix Carbon Traders", Role.UTILIZER, Sector.OTHER, "Kanpur", "Uttar Pradesh", 26.45, 80.33, "quickfix@carbon.local", "Applicant", CompanyStatus.REJECTED);
        companies.findById(QUICKFIX).ifPresent(c -> {
            c.setRejectionReason("Could not verify the registered address or the stated offtake capacity during the follow-up call.");
            companies.save(c);
        });
        audit.record(ADMIN, Role.ADMIN, "COMPANY_REJECTED", "Company", QUICKFIX,
                AuditService.details("name", "Quickfix Carbon Traders", "reason", "Address and capacity unverified"));
        notifications.notify(ADMIN, "SIGNUP_PENDING", "New sign-up awaiting verification",
                "Coastal Carbon Recovery registered as EMITTER from Mangaluru, Karnataka. Verify before approving.", "Company", COASTAL);
        audit.record(COASTAL, Role.EMITTER, "COMPANY_REGISTERED", "Company", COASTAL,
                AuditService.details("name", "Coastal Carbon Recovery", "role", "EMITTER"));

        // Trust consistent with the agreements created below.
        trust.set(UREA, 4, 2, 1);      // one cancelled contract
        trust.set(MALWA, 3, 2, 0);
        for (UUID c : List.of(VINDHYA, DECCANREF, DECTRANS, COASTAL, QUICKFIX)) trust.getOrCreate(c);

        // ---- Passports ----
        Co2Passport p346 = passport(P346, "CO2-IND-2026-000346", VINDHYA, "Cement kiln flue gas (line 1)", CarbonOrigin.PROCESS, "Amine capture (MEA)",
                30.0, 26.0, 34.0, 500, 95.9, PhysicalState.LIQUEFIED, 17.5, -24.0,
                imp(38, 140, 18, 10, 2, 12, 4600), "MTR-SAT-01", "Satna cement works, Madhya Pradesh", 24.57, 80.83, false,
                VerificationStatus.VERIFIED, LabCertificateStatus.ISSUED, now.minus(35, ChronoUnit.DAYS), now.plus(145, ChronoUnit.DAYS));
        Co2Passport p347 = passport(P347, "CO2-IND-2026-000347", DECCANREF, "Hydrogen unit off-gas", CarbonOrigin.FOSSIL, "Physical solvent (Rectisol)",
                55.0, 48.0, 62.0, 700, 99.1, PhysicalState.LIQUEFIED, 22.0, -22.0,
                imp(12, 35, 6, 2, 1, 3, 900), "MTR-VSK-04", "Visakhapatnam refinery, Andhra Pradesh", 17.69, 83.22, true,
                VerificationStatus.VERIFIED, LabCertificateStatus.ISSUED, now.minus(15, ChronoUnit.DAYS), now.plus(165, ChronoUnit.DAYS));
        Co2Passport p348 = passport(P348, "CO2-IND-2026-000348", VINDHYA, "Cement kiln flue gas (line 2)", CarbonOrigin.PROCESS, "Amine capture (MEA)",
                12.0, 10.0, 15.0, 250, 94.7, PhysicalState.GASEOUS, 9.0, 18.0,
                imp(60, 210, 26, 16, 4, 20, 6200), "MTR-SAT-02", "Satna cement works, Madhya Pradesh", 24.57, 80.83, false,
                VerificationStatus.PENDING, LabCertificateStatus.PENDING, null, null);
        // COA already past its expiry date. The scheduled job that runs right after seeding
        // flips this to EXPIRED, queues a priority-5 re-test and notifies the emitter, so the
        // expired-COA counter and the lab's expiring view are driven by the real rule.
        Co2Passport p349 = passport(P349, "CO2-IND-2026-000349", DECCANREF, "Fluid catalytic cracker flue gas", CarbonOrigin.FOSSIL, "Amine capture (MEA)",
                18.0, 15.0, 22.0, 300, 96.4, PhysicalState.LIQUEFIED, 18.0, -25.0,
                imp(50, 180, 30, 22, 6, 18, 5200), "MTR-VSK-09", "Visakhapatnam refinery, Andhra Pradesh", 17.69, 83.22, false,
                VerificationStatus.VERIFIED, LabCertificateStatus.ISSUED, now.minus(200, ChronoUnit.DAYS), now.minus(9, ChronoUnit.DAYS));
        for (Co2Passport p : List.of(p346, p347, p348, p349)) {
            audit.record(p.getEmitterId(), Role.EMITTER, "PASSPORT_CREATED", "Passport", p.getId(),
                    AuditService.details("code", p.getPassportCode(), "totalVolumeTonnes", p.getTotalVolumeTonnes()));
        }
        verification(id(6010), VerificationType.PASSPORT_COA, p346, null, 3, VerificationRequestStatus.APPROVED, LAB, "COA issued; measured 95.9% CO2", now.minus(36, ChronoUnit.DAYS), now.minus(35, ChronoUnit.DAYS));
        verification(id(6011), VerificationType.PASSPORT_COA, p347, null, 3, VerificationRequestStatus.APPROVED, LAB, "COA issued; measured 99.1% CO2", now.minus(16, ChronoUnit.DAYS), now.minus(15, ChronoUnit.DAYS));
        verification(id(6012), VerificationType.PASSPORT_COA, p348, null, 2, VerificationRequestStatus.QUEUED, null, null, now.minus(4, ChronoUnit.DAYS), null);
        verification(id(6013), VerificationType.PASSPORT_COA, p349, null, 3, VerificationRequestStatus.APPROVED, LAB, "Previous COA cycle; due for re-test", now.minus(201, ChronoUnit.DAYS), now.minus(200, ChronoUnit.DAYS));
        notifications.notify(LAB, "VERIFICATION_QUEUED", "New passport awaiting COA",
                "CO2-IND-2026-000348 from Vindhya Cement Industries needs an independent Certificate of Analysis.", "VerificationRequest", id(6012));

        // ---- Listings ----
        Listing l10 = listing(L10, p346, SaleMode.TENDER, ListingStatus.OPEN, 250, 4150, 94.0, null, today.plusDays(12), today.plusMonths(7), now.plus(8, ChronoUnit.DAYS),
                "Liquefied CO2 from kiln capture in central India. Rail-friendly; split awards considered.", now.minus(4, ChronoUnit.DAYS));
        Listing l11 = listing(L11, p347, SaleMode.TENDER, ListingStatus.OPEN, 400, 3900, 98.0, null, today.plusDays(18), today.plusMonths(9), now.plus(15, ChronoUnit.DAYS),
                "Very high purity refinery CO2, pipeline-connected. Suits food-grade and chemical synthesis.", now.minus(2, ChronoUnit.DAYS));
        // Opens shortly after boot, so the scheduled -> live transition can be shown twice.
        Listing l12 = auction(L12, p346, ListingStatus.SCHEDULED, 30, 4050, 75, now.plus(12, ChronoUnit.MINUTES), 30,
                today.plusDays(6), today.plusDays(21), "Spot lot from the Satna line.", now.minus(5, ChronoUnit.HOURS));
        // Closed without attracting a single proposal, which is a real outcome worth showing.
        Listing l13 = listing(L13, p347, SaleMode.TENDER, ListingStatus.CLOSED, 150, 4600, 98.0, null, today.minusMonths(2), today.minusDays(20), now.minus(25, ChronoUnit.DAYS),
                "Closed with no proposals - the asking price was above what buyers would pay.", now.minus(55, ChronoUnit.DAYS));
        Listing l14 = listing(L14, p346, SaleMode.TENDER, ListingStatus.AWARDED, 120, 4250, 94.0, null, today.minusDays(10), today.plusMonths(6), now.minus(12, ChronoUnit.DAYS),
                "Awarded to a chemicals buyer on the west coast.", now.minus(30, ChronoUnit.DAYS));
        Listing l15 = listing(L15, p346, SaleMode.TENDER, ListingStatus.AWARDED, 50, 4300, 94.0, null, today.plusDays(5), today.plusMonths(4), now.minus(2, ChronoUnit.DAYS),
                "Small greenhouse lot.", now.minus(9, ChronoUnit.DAYS));
        for (Listing l : List.of(l10, l11, l12, l13, l14, l15)) {
            audit.record(l.getEmitterId(), Role.EMITTER, "LISTING_CREATED", "Listing", l.getId(),
                    AuditService.details("mode", l.getMode().name(), "volumeTonnes", l.getVolumeTonnes(), "basePricePerTonne", l.getBasePricePerTonne()));
        }
        audit.record(DECCANREF, Role.EMITTER, "LISTING_CLOSED", "Listing", L13,
                AuditService.details("reason", "closed with no proposals", "releasedTonnes", 150));

        // ---- Competing proposals on the two open tenders ----
        proposal(id(2013), l10, p346, UREA, 200, 94.0, 12, "Monthly by rail to Ratnagiri", 4300, true, "Prefer ISO tanks", ProposalStatus.SUBMITTED, now.minus(3, ChronoUnit.DAYS));
        proposal(id(2014), l10, p346, MALWA, 150, 94.0, 6, "Fortnightly by road", 4200, true, null, ProposalStatus.SUBMITTED, now.minus(2, ChronoUnit.DAYS));
        proposal(id(2015), l10, p346, CONCRETE, 250, 94.0, 4, "Bulk lift", 4180, false, "Needs a 30-day window", ProposalStatus.SUBMITTED, now.minus(28, ChronoUnit.HOURS));
        proposal(id(2016), l11, p347, METHANOL, 400, 98.0, 12, "Pipeline where available, else rail", 4000, true, null, ProposalStatus.SUBMITTED, now.minus(36, ChronoUnit.HOURS));
        proposal(id(2017), l11, p347, ALGAE, 250, 98.0, 9, "Coastal shipping to Paradip", 3950, true, null, ProposalStatus.SUBMITTED, now.minus(20, ChronoUnit.HOURS));
        Proposal pr14 = proposal(id(2018), l14, p346, UREA, 120, 94.0, 6, "Monthly by rail", 4250, true, null, ProposalStatus.AWARDED, now.minus(26, ChronoUnit.DAYS));
        Proposal pr15 = proposal(id(2019), l15, p346, MALWA, 50, 94.0, 4, "Monthly by road", 4300, true, null, ProposalStatus.AWARDED, now.minus(8, ChronoUnit.DAYS));
        notifications.notify(VINDHYA, "PROPOSAL_RECEIVED", "New tender proposal on CO2-IND-2026-000346",
                "Konkan Urea Works offers ₹4300/t for 200 t.", "Listing", L10);
        notifications.notify(DECCANREF, "PROPOSAL_RECEIVED", "New tender proposal on CO2-IND-2026-000347",
                "Gujarat Methanol Synthesis offers ₹4000/t for 400 t.", "Listing", L11);

        // ---- Agreements: one active, one awaiting lab, one cancelled, and a year of history ----
        Agreement ax1 = agreement(id(3010), l14, pr14, null, VINDHYA, UREA, p346, SaleMode.TENDER, 120, 4250, AgreementStatus.ACTIVE,
                today.minusDays(10), today.plusMonths(6), 6, null, 10.0, false, 10.0, PricingStructure.FIXED, now.minus(26, ChronoUnit.DAYS));
        Agreement ax2 = agreement(id(3011), l15, pr15, null, VINDHYA, MALWA, p346, SaleMode.TENDER, 50, 4300, AgreementStatus.PENDING_VERIFICATION,
                today.plusDays(5), today.plusMonths(4), 4, null, 10.0, false, 10.0, PricingStructure.FIXED, now.minus(2, ChronoUnit.DAYS));
        verification(id(6015), VerificationType.SALE_APPROVAL, p346, ax2, 4, VerificationRequestStatus.QUEUED, null,
                "Sale approval: 50 t of CO2-IND-2026-000346 to Malwa Protected Cultivation", now.minus(2, ChronoUnit.DAYS), null);
        verification(id(6014), VerificationType.SALE_APPROVAL, p346, ax1, 4, VerificationRequestStatus.APPROVED, LAB,
                "Sale approved; specification matched the Passport", now.minus(26, ChronoUnit.DAYS), now.minus(25, ChronoUnit.DAYS));
        notifications.notify(MALWA, "TENDER_AWARDED", "Tender awarded: CO2-IND-2026-000346",
                "Vindhya Cement Industries awarded you 50 t at ₹4300/t. The sale is queued for independent lab approval.", "Agreement", id(3011));
        notifications.notify(LAB, "VERIFICATION_QUEUED", "Sale awaiting lab approval",
                "Agreement on CO2-IND-2026-000346 needs approval before it becomes active.", "VerificationRequest", id(6015));
        audit.record(VINDHYA, Role.EMITTER, "LISTING_AWARDED", "Listing", L14, AuditService.details("proposal", id(2018), "agreement", id(3010), "volumeTonnes", 120));
        audit.record(VINDHYA, Role.EMITTER, "LISTING_AWARDED", "Listing", L15, AuditService.details("proposal", id(2019), "agreement", id(3011), "volumeTonnes", 50));

        // Cancelled mid-term: the buyer walked away, which is why their badge carries a cancellation.
        Agreement ax3 = agreement(id(3012), null, null, null, DECCANREF, UREA, p347, SaleMode.CONTRACT, 200, 3850, AgreementStatus.CANCELLED,
                today.minusMonths(5), today.minusMonths(1), 4, 50.0, 10.0, false, 10.0, PricingStructure.FIXED, now.minus(160, ChronoUnit.DAYS));
        ax3.setCancelledByCompanyId(UREA);
        ax3.setCancelReason("Downstream urea line shut for unplanned maintenance; could not take delivery.");
        ax3.setUpdatedAt(now.minus(120, ChronoUnit.DAYS));
        agreements.save(ax3);
        audit.record(UREA, Role.UTILIZER, "AGREEMENT_CANCELLED", "Agreement", id(3012),
                AuditService.details("volumeTonnes", 200, "reason", "Downstream line shut for maintenance"));
        notifications.notify(DECCANREF, "AGREEMENT_CANCELLED", "Contract cancelled by the buyer",
                "Konkan Urea Works cancelled a 200 t contract before expiry. The volume has been returned to free stock.", "Agreement", id(3012));

        // Completed history, spread across the year so the regulator's monthly curve is not two spikes.
        agreement(id(3013), null, null, null, VINDHYA, MALWA, p346, SaleMode.TENDER, 300, 4100, AgreementStatus.COMPLETED,
                today.minusMonths(7), today.minusMonths(4), 3, null, 10.0, false, null, PricingStructure.FIXED, now.minus(215, ChronoUnit.DAYS));
        agreement(id(3014), null, null, null, DECCANREF, METHANOL, p347, SaleMode.TENDER, 800, 3750, AgreementStatus.COMPLETED,
                today.minusMonths(10), today.minusMonths(6), 4, null, 10.0, false, null, PricingStructure.FIXED, now.minus(305, ChronoUnit.DAYS));
        agreement(id(3015), null, null, null, VINDHYA, CONCRETE, p346, SaleMode.TENDER, 450, 4000, AgreementStatus.COMPLETED,
                today.minusMonths(3), today.minusMonths(1), 2, null, 10.0, false, null, PricingStructure.FIXED, now.minus(95, ChronoUnit.DAYS));
        agreement(id(3016), null, null, null, DECCANREF, ALGAE, p347, SaleMode.AUCTION, 90, 4400, AgreementStatus.COMPLETED,
                today.minusMonths(12), today.minusMonths(11), 1, null, 10.0, false, null, PricingStructure.FIXED, now.minus(365, ChronoUnit.DAYS));
        agreement(id(3017), null, null, null, VINDHYA, UREA, p346, SaleMode.TENDER, 180, 4150, AgreementStatus.COMPLETED,
                today.minusMonths(2), today.minusDays(20), 1, null, 10.0, false, null, PricingStructure.FIXED, now.minus(70, ChronoUnit.DAYS));

        // ---- Allocation: only OPEN/SCHEDULED listings and live agreements hold volume ----
        // 346 (500 t): L10 250 + L12 auction 30 + active 120 + pending-lab 50 = 450 locked, 50 free.
        p346.setAllocatedTonnes(450); passports.save(p346);
        // 347 (700 t): L11 400 only. L13 closed and the cancelled contract both released their volume.
        p347.setAllocatedTonnes(400); passports.save(p347);
        // 348 and 349 hold nothing: one is unverified, the other's COA has lapsed.
        p348.setAllocatedTonnes(0); passports.save(p348);
        p349.setAllocatedTonnes(0); passports.save(p349);

        // ---- Shipments on the Satna -> Ratnagiri lane, worked by the new carrier ----
        double satDist = GeoUtil.distanceKm(24.57, 80.83, 16.99, 73.30);
        double satHop = GeoUtil.distanceKm(24.57, 80.83, 17.38, 78.49);   // Satna -> Hyderabad depot

        Shipment x1 = shipment(id(5010), id(3010), DECTRANS, TransportMode.RAIL, satDist, 40,
                24.57, 80.83, 16.99, 73.30, now.minus(24, ChronoUnit.DAYS));
        x1.setSealNumber("SEAL-9104"); x1.setLoadedWeightTonnes(40.0); x1.setLoadMeterReading(41200.0);
        x1.setLoadSamplePurityPct(95.9); x1.setLoadedAt(now.minus(23, ChronoUnit.DAYS));
        x1.setDeliverySealNumber("SEAL-9104"); x1.setDeliveredWeightTonnes(39.5); x1.setDeliveryMeterReading(41240.0);
        x1.setDeliverySamplePurityPct(95.8); x1.setDeliveredAt(now.minus(21, ChronoUnit.DAYS));
        x1.setFlags(ReconciliationRules.evaluate(new ReconciliationRules.Input(
                "SEAL-9104", "SEAL-9104", 40.0, 39.5, 95.9, 95.8, 41200.0, 41240.0, 2.0)));
        x1.setStatus(x1.getFlags().isEmpty() ? ShipmentStatus.DELIVERED : ShipmentStatus.FLAGGED);
        x1.setTransportCost(satDist * 40 * 2.5 + 15000);
        shipments.save(x1);
        transportOffer(id(5110), id(5010), DECTRANS, TransportOfferStatus.ACCEPTED, satHop, x1.getTransportCost(), now.minus(24, ChronoUnit.DAYS));
        audit.record(VINDHYA, Role.EMITTER, "SHIPMENT_REQUESTED", "Shipment", id(5010), AuditService.details("agreement", id(3010), "volumeTonnes", 40, "mode", "RAIL"));
        audit.record(DECTRANS, Role.TRANSPORT, "TRANSPORT_ACCEPTED", "Shipment", id(5010), AuditService.details("provider", DECTRANS));
        audit.record(UREA, Role.UTILIZER, "SHIPMENT_DELIVERED", "Shipment", id(5010), AuditService.details("deliverySeal", "SEAL-9104", "deliveredWeightTonnes", 39.5, "flags", x1.getFlags()));

        Shipment x2 = shipment(id(5011), id(3010), DECTRANS, TransportMode.RAIL, satDist, 40,
                24.57, 80.83, 16.99, 73.30, now.minus(4, ChronoUnit.DAYS));
        x2.setSealNumber("SEAL-9188"); x2.setLoadedWeightTonnes(40.0); x2.setLoadMeterReading(41610.0);
        x2.setLoadSamplePurityPct(95.9); x2.setLoadedAt(now.minus(3, ChronoUnit.DAYS));
        x2.setStatus(ShipmentStatus.IN_TRANSIT);
        x2.setTransportCost(satDist * 40 * 2.5 + 15000);
        shipments.save(x2);
        transportOffer(id(5111), id(5011), DECTRANS, TransportOfferStatus.ACCEPTED, satHop, x2.getTransportCost(), now.minus(4, ChronoUnit.DAYS));
        audit.record(DECTRANS, Role.TRANSPORT, "TRANSPORT_ACCEPTED", "Shipment", id(5011), AuditService.details("provider", DECTRANS));
        audit.record(VINDHYA, Role.EMITTER, "SHIPMENT_LOADED", "Shipment", id(5011), AuditService.details("seal", "SEAL-9188", "loadedWeightTonnes", 40.0));

        // Purity drifted well beyond tolerance in transit: a different failure from the seal mismatch.
        Shipment x3 = shipment(id(5012), id(3010), DECTRANS, TransportMode.TRUCK, satDist, 20,
                24.57, 80.83, 16.99, 73.30, now.minus(47, ChronoUnit.DAYS));
        x3.setSealNumber("SEAL-9061"); x3.setLoadedWeightTonnes(20.0); x3.setLoadMeterReading(40650.0);
        x3.setLoadSamplePurityPct(95.9); x3.setLoadedAt(now.minus(46, ChronoUnit.DAYS));
        x3.setDeliverySealNumber("SEAL-9061"); x3.setDeliveredWeightTonnes(19.9); x3.setDeliveryMeterReading(40670.0);
        x3.setDeliverySamplePurityPct(93.1); x3.setDeliveredAt(now.minus(44, ChronoUnit.DAYS));
        x3.setFlags(ReconciliationRules.evaluate(new ReconciliationRules.Input(
                "SEAL-9061", "SEAL-9061", 20.0, 19.9, 95.9, 93.1, 40650.0, 40670.0, 2.0)));
        x3.setStatus(x3.getFlags().isEmpty() ? ShipmentStatus.DELIVERED : ShipmentStatus.FLAGGED);
        x3.setTransportCost(satDist * 20 * 4.0 + 5000);
        shipments.save(x3);
        transportOffer(id(5112), id(5012), DECTRANS, TransportOfferStatus.ACCEPTED, satHop, x3.getTransportCost(), now.minus(47, ChronoUnit.DAYS));
        audit.record(UREA, Role.UTILIZER, "SHIPMENT_FLAGGED", "Shipment", id(5012),
                AuditService.details("deliverySamplePurityPct", 93.1, "flags", x3.getFlags()));
        notifications.notify(VINDHYA, "SHIPMENT_FLAGGED", "Shipment flagged on delivery",
                "Purity fell from 95.9% at loading to 93.1% on arrival at Ratnagiri. Reconciliation failed on the lab sample.", "Shipment", id(5012));
        notifications.notify(DECTRANS, "SHIPMENT_FLAGGED", "Your delivery was flagged",
                "A purity drift was recorded on the Satna to Ratnagiri run. The lab has been notified.", "Shipment", id(5012));

        // Advertised and still unclaimed: three carriers notified, one already passed.
        Shipment x4 = shipment(id(5013), id(3010), null, TransportMode.RAIL, satDist, 40,
                24.57, 80.83, 16.99, 73.30, now.minus(3, ChronoUnit.HOURS));
        x4.setStatus(ShipmentStatus.REQUESTED);
        x4.setTransportCost(satDist * 40 * 2.5 + 15000);
        shipments.save(x4);
        transportOffer(id(5113), id(5013), DECTRANS, TransportOfferStatus.NOTIFIED, satHop, null, now.minus(3, ChronoUnit.HOURS));
        transportOffer(id(5114), id(5013), GUJTRANS, TransportOfferStatus.NOTIFIED,
                GeoUtil.distanceKm(24.57, 80.83, 22.47, 70.06), null, now.minus(3, ChronoUnit.HOURS));
        transportOffer(id(5115), id(5013), ODTRANS, TransportOfferStatus.REJECTED,
                GeoUtil.distanceKm(24.57, 80.83, 20.46, 85.88), null, now.minus(2, ChronoUnit.HOURS));
        notifications.notify(DECTRANS, "TRANSPORT_REQUEST", "Shipment request near you",
                String.format("40 t of LIQUEFIED CO2 by RAIL, Satna → Ratnagiri (%.0f km). Estimated ₹%.0f. Accept or reject.", satDist, x4.getTransportCost()), "Shipment", id(5013));
        notifications.notify(GUJTRANS, "TRANSPORT_REQUEST", "Shipment request near you",
                String.format("40 t of LIQUEFIED CO2 by RAIL, Satna → Ratnagiri (%.0f km). Estimated ₹%.0f. Accept or reject.", satDist, x4.getTransportCost()), "Shipment", id(5013));
        audit.record(VINDHYA, Role.EMITTER, "SHIPMENT_REQUESTED", "Shipment", id(5013),
                AuditService.details("agreement", id(3010), "volumeTonnes", 40, "mode", "RAIL", "providersNotified", 3));

        // Accepted but not yet loaded, so every shipment state appears somewhere in the seed.
        double mundraDist = GeoUtil.distanceKm(22.84, 69.72, 21.70, 72.57);
        Shipment x5 = shipment(id(5014), A_CONTRACT, GUJTRANS, TransportMode.TRUCK, mundraDist, 40,
                22.84, 69.72, 21.70, 72.57, now.minus(10, ChronoUnit.HOURS));
        x5.setStatus(ShipmentStatus.ACCEPTED);
        x5.setTransportCost(mundraDist * 40 * 4.0 + 5000);
        shipments.save(x5);
        transportOffer(id(5116), id(5014), GUJTRANS, TransportOfferStatus.ACCEPTED,
                GeoUtil.distanceKm(22.84, 69.72, 22.47, 70.06), x5.getTransportCost(), now.minus(10, ChronoUnit.HOURS));
        audit.record(GUJTRANS, Role.TRANSPORT, "TRANSPORT_ACCEPTED", "Shipment", id(5014), AuditService.details("provider", GUJTRANS));
        notifications.notify(POWER, "TRANSPORT_ACCEPTED", "A carrier accepted your shipment",
                "Saurashtra Cryo Logistics accepted the Mundra to Dahej run and will collect shortly.", "Shipment", id(5014));

        // ---- A second forecast, so the shortfall alert is not a one-off ----
        OutputForecast f2 = new OutputForecast();
        f2.setId(id(7002)); f2.setPassportId(P346); f2.setPeriodStart(today.plusDays(20)); f2.setPeriodEnd(today.plusDays(27));
        f2.setExpectedTonnesPerDay(18); f2.setReason("Kiln refractory relining, line 1");
        forecasts.save(f2);
        int notified2 = passportService.notifyShortfall(f2, p346);
        audit.record(VINDHYA, Role.EMITTER, "FORECAST_ADDED", "Passport", P346,
                AuditService.details("expectedTonnesPerDay", 18, "utilizersNotified", notified2));

        // Badges for the new emitters follow from the agreements above.
        trust.refreshBadge(VINDHYA, DECCANREF);

        notifications.notify(REGULATOR, "COMPLIANCE_ALERT", "Two shipments flagged this month",
                "Reconciliation failed on a Mundra to Dahej run (seal and weight) and a Satna to Ratnagiri run (purity). Both are visible in the company drill-down.", "Company", VINDHYA);
    }

    /** Shared skeleton for the extra seeded shipments; the caller fills in seal and weight detail. */
    private Shipment shipment(UUID id, UUID agreementId, UUID provider, TransportMode mode, double distanceKm, double volume,
                              double originLat, double originLng, double destLat, double destLng, Instant created) {
        Shipment s = new Shipment();
        s.setId(id); s.setAgreementId(agreementId); s.setTransportProviderId(provider); s.setOwnTransport(false);
        s.setTransportMode(mode); s.setDistanceKm(distanceKm); s.setVolumeTonnes(volume);
        s.setOriginLat(originLat); s.setOriginLng(originLng); s.setDestLat(destLat); s.setDestLng(destLng);
        s.setCreatedAt(created);
        return s;
    }

    // ---- builders ----

    private void company(UUID id, String name, Role role, Sector sector, String city, String state, double lat, double lng,
                         String email, String contact, CompanyStatus status) {
        UUID userId = id(Integer.parseInt(id.toString().substring(33)) + 100); // company ...0001xx → user ...0002xx
        Company c = new Company();
        c.setId(id); c.setName(name); c.setRole(role); c.setStatus(status); c.setContactEmail(email); c.setContactPhone("+91-98000-" + String.format("%05d", Math.abs(id.hashCode()) % 100000));
        c.setAddress("Industrial Area"); c.setCity(city); c.setState(state); c.setCountry("India"); c.setLatitude(lat); c.setLongitude(lng);
        c.setSector(sector); c.setRegistrationNumber("CIN-" + String.format("%06d", Math.abs(name.hashCode()) % 1000000));
        Map<String, Object> profile = new LinkedHashMap<>();
        switch (role) {
            case EMITTER -> { profile.put("annualEmissionsTonnes", 250000); profile.put("captureCapacityTonnesPerDay", 60); profile.put("plantType", sector.name()); }
            case UTILIZER -> { profile.put("useCase", sector.name()); profile.put("annualDemandTonnes", 5000); profile.put("requiredPurityPct", 95); }
            case TRANSPORT -> { profile.put("fleet", List.of("Cryogenic tanker x6", "ISO tank x12")); profile.put("modes", List.of("TRUCK", "RAIL")); profile.put("serviceRadiusKm", 400); }
            case LAB -> { profile.put("accreditation", "NABL ISO/IEC 17025"); profile.put("capabilities", List.of("GC-MS", "Moisture", "Sulphur species")); }
            case REGULATOR -> { profile.put("agency", "NITI Aayog CCUS Mission"); profile.put("jurisdiction", "India"); }
            default -> {}
        }
        c.setRoleProfile(profile);
        c.setCreatedAt(Instant.now().minus(200, ChronoUnit.DAYS));
        if (status == CompanyStatus.APPROVED) c.setApprovedAt(Instant.now().minus(190, ChronoUnit.DAYS));
        companies.save(c);
        auth.createUser(userId, id, email, PASSWORD, contact, role);
        audit.record(ADMIN, Role.ADMIN, status == CompanyStatus.APPROVED ? "COMPANY_APPROVED" : "COMPANY_REGISTERED", "Company", id, AuditService.details("name", name, "role", role.name()));
    }

    private static Map<String, Object> imp(double h2o, double o2, double nox, double sox, double h2s, double co, double n2) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("H2O", h2o); m.put("O2", o2); m.put("NOx", nox); m.put("SOx", sox); m.put("H2S", h2s); m.put("CO", co); m.put("N2", n2);
        return m;
    }

    private Co2Passport passport(UUID id, String code, UUID emitter, String source, CarbonOrigin origin, String tech, double daily, double min, double max,
                                 double total, double conc, PhysicalState state, double bar, double temp, Map<String, Object> impurities, String meter,
                                 String location, double lat, double lng, boolean pipeline, VerificationStatus vs, LabCertificateStatus lcs,
                                 Instant coaIssued, Instant coaExpires) {
        Co2Passport p = new Co2Passport();
        p.setId(id); p.setPassportCode(code); p.setEmitterId(emitter); p.setSource(source); p.setCarbonOrigin(origin); p.setCaptureTechnology(tech);
        p.setDailyTonnage(daily); p.setDailyTonnageMin(min); p.setDailyTonnageMax(max); p.setTotalVolumeTonnes(total); p.setConcentrationPct(conc);
        p.setPhysicalState(state); p.setPressureBar(bar); p.setTemperatureC(temp); p.setImpurities(impurities); p.setMeterId(meter);
        p.setLocationName(location); p.setLatitude(lat); p.setLongitude(lng); p.setPipelineConnected(pipeline);
        p.setAvailabilityStart(LocalDate.now().minusMonths(1)); p.setAvailabilityEnd(LocalDate.now().plusMonths(12));
        p.setVerificationStatus(vs); p.setLabCertificateStatus(lcs); p.setCoaIssuedAt(coaIssued); p.setCoaExpiresAt(coaExpires);
        if (coaIssued != null) p.setIssuingLabId(LAB);
        p.setCaptureTimestamp(Instant.now().minus(1, ChronoUnit.DAYS));
        p.setCertifications(List.of(Map.of("name", "Lab COA (PDF)", "url", "https://res.cloudinary.com/demo/co2/coa-" + code + ".pdf"),
                Map.of("name", "MRV meter calibration", "url", "https://res.cloudinary.com/demo/co2/calib-" + meter + ".pdf")));
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("mrvProvider", "Internal SCADA export"); extra.put("captureUnitVendor", "Carbon Clean"); extra.put("hourlyMeterExport", true);
        p.setExtraAttributes(extra);
        p.setCreatedAt(Instant.now().minus(90, ChronoUnit.DAYS));
        return passports.save(p);
    }

    private VerificationRequest verification(UUID id, VerificationType type, Co2Passport p, Agreement a, int priority, VerificationRequestStatus status,
                                             UUID lab, String notes, Instant submitted, Instant decided) {
        VerificationRequest v = new VerificationRequest();
        v.setId(id); v.setType(type); v.setPassportId(p.getId()); v.setAgreementId(a == null ? null : a.getId()); v.setPriority(priority);
        v.setStatus(status); v.setLabId(lab); v.setNotes(notes); v.setSubmittedAt(submitted); v.setDecidedAt(decided);
        v.setClaimedSpecs(PassportService.claimedSpecs(p));
        if (status == VerificationRequestStatus.APPROVED) {
            Map<String, Object> measured = new LinkedHashMap<>();
            measured.put("concentrationPct", p.getConcentrationPct()); measured.put("impurities", p.getImpurities());
            v.setMeasuredSpecs(measured);
        }
        return verifications.save(v);
    }

    private Listing listing(UUID id, Co2Passport p, SaleMode mode, ListingStatus status, double vol, double price, Double minPurity, Double reserve,
                            LocalDate from, LocalDate to, Instant closes, String desc, Instant created) {
        Listing l = new Listing();
        l.setId(id); l.setPassportId(p.getId()); l.setEmitterId(p.getEmitterId()); l.setMode(mode); l.setStatus(status); l.setVolumeTonnes(vol);
        l.setBasePricePerTonne(price); l.setMinPurityPct(minPurity); l.setReservePricePerTonne(reserve); l.setDeliveryWindowStart(from);
        l.setDeliveryWindowEnd(to); l.setClosesAt(closes); l.setDescription(desc); l.setCreatedAt(created);
        return listings.save(l);
    }

    private Listing auction(UUID id, Co2Passport p, ListingStatus status, double vol, double base, double increment,
                            Instant start, int durationMinutes, LocalDate from, LocalDate to, String desc, Instant created) {
        Listing l = new Listing();
        l.setId(id); l.setPassportId(p.getId()); l.setEmitterId(p.getEmitterId()); l.setMode(SaleMode.AUCTION); l.setStatus(status);
        l.setVolumeTonnes(vol); l.setBasePricePerTonne(base); l.setBidIncrement(increment); l.setScheduledStartAt(start);
        l.setDurationMinutes(durationMinutes); l.setClosesAt(start.plusSeconds(durationMinutes * 60L));
        l.setDeliveryWindowStart(from); l.setDeliveryWindowEnd(to); l.setDescription(desc); l.setCreatedAt(created);
        l.setMinPurityPct(p.getConcentrationPct());
        return listings.save(l);
    }

    private AuctionBid bid(UUID id, UUID listingId, UUID utilizer, double perTonne, double volume, Instant at) {
        AuctionBid b = new AuctionBid();
        b.setId(id); b.setListingId(listingId); b.setUtilizerId(utilizer); b.setAmountPerTonne(perTonne);
        b.setTotalAmount(perTonne * volume); b.setBindingAccepted(true); b.setBindingTerms(AuctionService.BINDING_TERMS);
        b.setPlacedAt(at);
        auctionBids.save(b);
        audit.record(utilizer, Role.UTILIZER, "AUCTION_BID", "Listing", listingId,
                AuditService.details("amountPerTonne", perTonne, "totalAmount", perTonne * volume, "bidder", utilizer));
        return b;
    }

    private Proposal proposal(UUID id, Listing l, Co2Passport p, UUID utilizer, double qty, Double purity, int months, String delivery, double price,
                              boolean escrow, String other, ProposalStatus status, Instant created) {
        Proposal pr = new Proposal();
        pr.setId(id); pr.setListingId(l.getId()); pr.setUtilizerId(utilizer); pr.setQuantityTonnes(qty); pr.setRequiredPurityPct(purity);
        pr.setDurationMonths(months); pr.setDeliveryRequirement(delivery); pr.setOfferedPricePerTonne(price); pr.setAcceptsEscrow(escrow);
        pr.setOtherRequirements(other); pr.setStatus(status); pr.setCreatedAt(created);
        listingService.score(pr, l, p, companies.findById(utilizer).orElseThrow(), trust.getOrCreate(utilizer));
        proposals.save(pr);
        audit.record(utilizer, Role.UTILIZER, "PROPOSAL_SUBMITTED", "Proposal", id, AuditService.details("listing", l.getId(), "quantityTonnes", qty, "offeredPricePerTonne", price, "score", pr.getScore()));
        return pr;
    }

    private Agreement agreement(UUID id, Listing l, Proposal pr, Negotiation n, UUID emitter, UUID utilizer, Co2Passport p, SaleMode mode, double vol,
                                double price, AgreementStatus status, LocalDate start, LocalDate end, int months, Double perMonth, Double deposit,
                                boolean takeOrPay, Double gap, PricingStructure ps, Instant created) {
        Agreement a = new Agreement();
        a.setId(id); a.setListingId(l == null ? null : l.getId()); a.setProposalId(pr == null ? null : pr.getId()); a.setNegotiationId(n == null ? null : n.getId());
        a.setEmitterId(emitter); a.setUtilizerId(utilizer); a.setPassportId(p.getId()); a.setMode(mode); a.setVolumeTonnes(vol); a.setPricePerTonne(price);
        a.setStatus(status); a.setStartsAt(start); a.setEndsAt(end); a.setDurationMonths(months); a.setVolumePerMonth(perMonth); a.setDepositPct(deposit);
        a.setTakeOrPay(takeOrPay); a.setSupplyGapThresholdPct(gap); a.setPricingStructure(ps); a.setCreatedAt(created); a.setUpdatedAt(created);
        Company u = companies.findById(utilizer).orElseThrow();
        double dist = GeoUtil.distanceKm(p.getLatitude(), p.getLongitude(), u.getLatitude(), u.getLongitude());
        CostCalculator.Result cs = l != null
                ? costService.calculate(l, p, vol, pr == null ? null : pr.getRequiredPurityPct(), TransportMode.TRUCK, null, dist)
                : costService.calculateForPrice(price, p, perMonth == null ? vol : perMonth, TransportMode.TRUCK, dist);
        a.setCostStack(cs.toMap());
        return agreements.save(a);
    }

    private ContractOffer offer(UUID id, Negotiation n, int version, UUID by, double price, double perMonth, int months, PricingStructure ps, boolean top,
                                Double gap, Double deposit, String msg, OfferStatus status, Instant created) {
        ContractOffer o = new ContractOffer();
        o.setId(id); o.setNegotiationId(n.getId()); o.setVersion(version); o.setProposedByCompanyId(by); o.setPricePerTonne(price); o.setVolumePerMonth(perMonth);
        o.setDurationMonths(months); o.setPricingStructure(ps); o.setTakeOrPay(top); o.setSupplyGapThresholdPct(gap); o.setDepositPct(deposit); o.setMessage(msg);
        o.setStatus(status); o.setCreatedAt(created);
        return offers.save(o);
    }
    /** One seeded carrier offer. Quote is null while the job is still only advertised. */
    private void transportOffer(UUID id, UUID shipmentId, UUID providerId, TransportOfferStatus status,
                                double distanceFromOriginKm, Double quotedPrice, Instant createdAt) {
        TransportOffer o = new TransportOffer();
        o.setId(id);
        o.setShipmentId(shipmentId);
        o.setProviderId(providerId);
        o.setStatus(status);
        o.setDistanceFromOriginKm(distanceFromOriginKm);
        o.setQuotedPrice(quotedPrice);
        o.setCreatedAt(createdAt);
        transportOffers.save(o);
    }
}
