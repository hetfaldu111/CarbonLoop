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
 * ID scheme: companies ...000101-130, users ...000201-230 (company + 100), passports ...000342-357,
 * listings ...001001-1028, proposals ...002001-2050, agreements ...003001-3031, negotiations ...004001-4010,
 * contract offers ...004101+, shipments ...005001-5026, transport offers ...005101-5140,
 * verification requests ...006001+, forecasts ...007001+, auction bids ...008001+.
 *
 * The set is sized so that every page has several rows and no filter comes back empty: each listing,
 * agreement, shipment, transport-offer, negotiation, verification and passport state appears at least
 * twice, across 12 states and every sector.
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
            DECTRANS = id(118), COASTAL = id(119), SURYANAGAR = id(120);
    public static final UUID P346 = id(346), P347 = id(347), P348 = id(348), P349 = id(349);
    public static final UUID L10 = id(1010), L11 = id(1011), L12 = id(1012), L13 = id(1013), L14 = id(1014), L15 = id(1015);

    // ---- Wider demo set: four more emitters, four more utilizers, a fourth carrier, a second lab ----
    public static final UUID TARAPUR = id(121), SUNDARGARH = id(122), KORBA = id(123), THAR = id(124),
            SPIRULINA = id(125), PRECAST = id(126), BEVGAS = id(127), SYNFUEL = id(128),
            SAHYADRI = id(129), EASTLAB = id(130);
    /** Sign-ups still sitting in the admin's approvals queue, oldest first. */
    public static final UUID PARASNATH = id(131), BRAHMAPUTRA = id(132), SUNDARBAN = id(133),
            DOABA = id(134), GTCRYO = id(135), HIMALAB = id(136);
    public static final UUID P350 = id(350), P351 = id(351), P352 = id(352), P353 = id(353),
            P354 = id(354), P355 = id(355), P356 = id(356), P357 = id(357);
    public static final UUID L16 = id(1016), L17 = id(1017), L18 = id(1018), L19 = id(1019), L20 = id(1020),
            L21 = id(1021), L22 = id(1022), L23 = id(1023), L24 = id(1024), L25 = id(1025),
            L26 = id(1026), L27 = id(1027), L28 = id(1028), L29 = id(1029);
    /** Negotiation threads: 4001 is the original signed contract, 4002-4010 widen the states. */
    public static final UUID NEG_CEM_CONC = id(4002), NEG_STL_ALGAE = id(4003), NEG_PWR_GH = id(4004),
            NEG_CEM_METH = id(4005), NEG_STL_CONC = id(4006), NEG_TAR_BEV = id(4007),
            NEG_KOR_SYN = id(4008), NEG_VIN_MAL = id(4009), NEG_DEC_SPI = id(4010);

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

        notifications.notify(NEWCO, "SIGNUP_PENDING", "Your registration is under review",
                "Thanks for registering Bharat Bio-CO2 Ltd. The platform team verifies every new company before it can publish a CO2 Passport.", "Company", NEWCO);
        notifications.notify(STEEL, "PROPOSAL_RECEIVED", "Three proposals on CO2-IND-2026-000343",
                "1000 t tender: two buyers want 500 t each and one wants the whole lot. Open the tender to compare the combinations.", "Listing", L7);
        notifications.notify(METHANOL, "PROPOSAL_SUBMITTED", "Proposal submitted on CO2-IND-2026-000343",
                "Your bid of ₹4400/t for 500 t is in. The emitter may award part of the lot to more than one buyer.", "Listing", L7);
        notifications.notify(ALGAE, "PROPOSAL_SUBMITTED", "Proposal submitted on CO2-IND-2026-000343",
                "Your bid of ₹4300/t for 500 t is in. Partial awards are allowed on this tender.", "Listing", L7);

        seedExpandedDemoSet(now, today);
        seedWiderDemoSet(now, today);
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
        // A rejected application, so that state is visible somewhere.
        // Entirely invented name: no real firm is ever placed in a negative role in this seed.
        company(SURYANAGAR, "Suryanagar Carbon Traders", Role.UTILIZER, Sector.OTHER, "Kanpur", "Uttar Pradesh", 26.45, 80.33, "suryanagar@carbon.local", "Applicant", CompanyStatus.REJECTED);
        companies.findById(SURYANAGAR).ifPresent(c -> {
            c.setRejectionReason("Could not verify the registered address or the stated offtake capacity during the follow-up call.");
            companies.save(c);
        });
        audit.record(ADMIN, Role.ADMIN, "COMPANY_REJECTED", "Company", SURYANAGAR,
                AuditService.details("name", "Suryanagar Carbon Traders", "reason", "Address and capacity unverified"));
        notifications.notify(ADMIN, "SIGNUP_PENDING", "New sign-up awaiting verification",
                "Coastal Carbon Recovery registered as EMITTER from Mangaluru, Karnataka. Verify before approving.", "Company", COASTAL);
        notifications.notify(COASTAL, "SIGNUP_PENDING", "Your registration is under review",
                "Thanks for registering Coastal Carbon Recovery. The platform team verifies every new company before it can trade; you will be notified as soon as the review is done.", "Company", COASTAL);
        audit.record(COASTAL, Role.EMITTER, "COMPANY_REGISTERED", "Company", COASTAL,
                AuditService.details("name", "Coastal Carbon Recovery", "role", "EMITTER"));

        // Trust consistent with the agreements created below.
        trust.set(UREA, 4, 2, 1);      // one cancelled contract
        trust.set(MALWA, 3, 2, 0);
        for (UUID c : List.of(VINDHYA, DECCANREF, DECTRANS, COASTAL, SURYANAGAR)) trust.getOrCreate(c);

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

    // =====================================================================================
    // Wider demo set
    // -------------------------------------------------------------------------------------
    // Four more emitters, four more utilizers, a fourth carrier and a second lab, each with
    // their own passports, listings, proposals, agreements and shipments. Everything here is
    // here so that no page shows a lone row and no status filter comes back empty: a second
    // LIVE auction and an ENDED one, two CANCELLED listings, a tender closed after rejecting
    // its proposals, a REJECTED passport, an IN_REVIEW lab review, a second expired COA,
    // weight-gap and meter-mismatch reconciliation flags, and EXPIRED carrier offers.
    // =====================================================================================
    private void seedWiderDemoSet(Instant now, LocalDate today) {
        // ---- Companies: Maharashtra, Chhattisgarh, Rajasthan, Tamil Nadu added ----
        company(TARAPUR, "Tarapur Ammonia & Chemicals", Role.EMITTER, Sector.CHEMICALS, "Boisar", "Maharashtra", 19.80, 72.75, "tarapur@carbon.local", "Vivek Ranade", CompanyStatus.APPROVED);
        company(SUNDARGARH, "Sundargarh Sponge Iron", Role.EMITTER, Sector.STEEL, "Rourkela", "Odisha", 22.26, 84.85, "sundargarh@carbon.local", "Bibhu Behera", CompanyStatus.APPROVED);
        company(KORBA, "Korba Valley Power Station", Role.EMITTER, Sector.POWER, "Korba", "Chhattisgarh", 22.35, 82.68, "korba@carbon.local", "Shalini Verma", CompanyStatus.APPROVED);
        company(THAR, "Thar Petro Refining", Role.EMITTER, Sector.REFINERY, "Barmer", "Rajasthan", 25.75, 71.38, "thar@carbon.local", "Mahendra Singh", CompanyStatus.APPROVED);
        company(SPIRULINA, "Nilgiri Spirulina Farms", Role.UTILIZER, Sector.ALGAE, "Coimbatore", "Tamil Nadu", 11.02, 76.96, "spirulina@carbon.local", "Aravind Krishnan", CompanyStatus.APPROVED);
        company(PRECAST, "Warangal Precast Blocks", Role.UTILIZER, Sector.BUILDING_MATERIALS, "Warangal", "Telangana", 17.98, 79.59, "precast@carbon.local", "Sridhar Rao", CompanyStatus.APPROVED);
        company(BEVGAS, "Palar Valley Beverage Gases", Role.UTILIZER, Sector.OTHER, "Hosur", "Tamil Nadu", 12.74, 77.83, "bevgas@carbon.local", "Latha Subramanian", CompanyStatus.APPROVED);
        company(SYNFUEL, "Yamuna Synfuels", Role.UTILIZER, Sector.FUEL_SYNTHESIS, "Mathura", "Uttar Pradesh", 27.49, 77.67, "synfuel@carbon.local", "Rakesh Agarwal", CompanyStatus.APPROVED);
        company(SAHYADRI, "Sahyadri Cryo Carriers", Role.TRANSPORT, Sector.LOGISTICS, "Pune", "Maharashtra", 18.52, 73.86, "sahyadri@carbon.local", "Nandkumar Pawar", CompanyStatus.APPROVED);
        company(EASTLAB, "Eastern Gas Analytics", Role.LAB, Sector.LAB, "Bhubaneswar", "Odisha", 20.30, 85.82, "eastlab@carbon.local", "Dr. Ananya Sahu", CompanyStatus.APPROVED);

        // Utilizer badges band on completed vs cancelled agreements, so every tier is represented.
        trust.set(SPIRULINA, 8, 8, 0);   // 100 → DIAMOND
        trust.set(PRECAST, 6, 5, 0);     // 83  → GOLD
        trust.set(BEVGAS, 5, 3, 0);      // 60  → SILVER
        trust.set(SYNFUEL, 2, 0, 1);     // 0   → BRONZE
        for (UUID c : List.of(TARAPUR, SUNDARGARH, KORBA, THAR, SAHYADRI, EASTLAB)) trust.getOrCreate(c);

        // ---- Passports ----
        Co2Passport p350 = passport(P350, "CO2-IND-2026-000350", TARAPUR, "Ammonia synthesis purge gas", CarbonOrigin.PROCESS, "Physical solvent (Selexol)",
                45.0, 40.0, 52.0, 800, 99.4, PhysicalState.LIQUEFIED, 21.0, -23.0,
                imp(8, 25, 4, 1, 0.5, 2, 600), "MTR-BOI-02", "Tarapur chemical complex, Maharashtra", 19.80, 72.75, true,
                VerificationStatus.VERIFIED, LabCertificateStatus.ISSUED, now.minus(28, ChronoUnit.DAYS), now.plus(152, ChronoUnit.DAYS));
        Co2Passport p351 = passport(P351, "CO2-IND-2026-000351", SUNDARGARH, "Sponge iron kiln off-gas", CarbonOrigin.FOSSIL, "Amine capture (MEA)",
                28.0, 24.0, 33.0, 600, 93.8, PhysicalState.GASEOUS, 7.0, 22.0,
                imp(220, 900, 55, 30, 7, 400, 9600), "MTR-RKL-05", "Rourkela sponge iron works, Odisha", 22.26, 84.85, false,
                VerificationStatus.VERIFIED, LabCertificateStatus.ISSUED, now.minus(50, ChronoUnit.DAYS), now.plus(130, ChronoUnit.DAYS));
        Co2Passport p352 = passport(P352, "CO2-IND-2026-000352", KORBA, "Lignite boiler flue gas", CarbonOrigin.FOSSIL, "Amine capture (advanced solvent)",
                70.0, 62.0, 80.0, 2000, 97.6, PhysicalState.LIQUEFIED, 19.0, -21.0,
                imp(26, 75, 14, 6, 1, 8, 1900), "MTR-KRB-01", "Korba power station, Chhattisgarh", 22.35, 82.68, false,
                VerificationStatus.VERIFIED, LabCertificateStatus.ISSUED, now.minus(25, ChronoUnit.DAYS), now.plus(155, ChronoUnit.DAYS));
        Co2Passport p353 = passport(P353, "CO2-IND-2026-000353", THAR, "Hydrogen unit off-gas", CarbonOrigin.FOSSIL, "Physical solvent (Rectisol)",
                38.0, 33.0, 44.0, 900, 98.9, PhysicalState.LIQUEFIED, 22.0, -22.0,
                imp(14, 40, 7, 3, 1, 4, 1100), "MTR-BRM-03", "Barmer refinery, Rajasthan", 25.75, 71.38, true,
                VerificationStatus.VERIFIED, LabCertificateStatus.ISSUED, now.minus(10, ChronoUnit.DAYS), now.plus(170, ChronoUnit.DAYS));
        // The lab measured well below the claimed concentration, so this one was rejected outright.
        Co2Passport p354 = passport(P354, "CO2-IND-2026-000354", SUNDARGARH, "Coal gasifier raw gas", CarbonOrigin.FOSSIL, "Amine capture (MEA)",
                16.0, 12.0, 20.0, 350, 94.0, PhysicalState.GASEOUS, 6.0, 25.0,
                imp(400, 1500, 90, 60, 18, 900, 15000), "MTR-RKL-08", "Rourkela sponge iron works, Odisha", 22.26, 84.85, false,
                VerificationStatus.REJECTED, LabCertificateStatus.NONE, null, null);
        // Claimed but not yet certified; a lab has picked it up and is mid-review.
        Co2Passport p355 = passport(P355, "CO2-IND-2026-000355", KORBA, "Lignite boiler flue gas (unit 3)", CarbonOrigin.FOSSIL, "Amine capture (MEA)",
                22.0, 18.0, 27.0, 500, 96.2, PhysicalState.LIQUEFIED, 18.0, -24.0,
                imp(44, 160, 22, 13, 3, 16, 5400), "MTR-KRB-03", "Korba power station, Chhattisgarh", 22.35, 82.68, false,
                VerificationStatus.PENDING, LabCertificateStatus.PENDING, null, null);
        // A second COA that lapsed: the startup job flips it to EXPIRED and re-queues it at priority 5.
        Co2Passport p356 = passport(P356, "CO2-IND-2026-000356", THAR, "Sulphur recovery unit tail gas", CarbonOrigin.FOSSIL, "Amine capture (MEA)",
                12.0, 9.0, 15.0, 300, 95.6, PhysicalState.LIQUEFIED, 17.0, -25.0,
                imp(55, 190, 34, 40, 9, 20, 5600), "MTR-BRM-07", "Barmer refinery, Rajasthan", 25.75, 71.38, false,
                VerificationStatus.VERIFIED, LabCertificateStatus.ISSUED, now.minus(189, ChronoUnit.DAYS), now.minus(3, ChronoUnit.DAYS));
        Co2Passport p357 = passport(P357, "CO2-IND-2026-000357", TARAPUR, "Ammonia synthesis purge gas (line 2)", CarbonOrigin.PROCESS, "Physical solvent (Selexol)",
                26.0, 22.0, 31.0, 500, 99.1, PhysicalState.LIQUEFIED, 20.0, -23.0,
                imp(10, 30, 5, 2, 1, 3, 700), "MTR-BOI-05", "Tarapur chemical complex, Maharashtra", 19.80, 72.75, true,
                VerificationStatus.VERIFIED, LabCertificateStatus.ISSUED, now.minus(17, ChronoUnit.DAYS), now.plus(163, ChronoUnit.DAYS));
        for (Co2Passport p : List.of(p350, p351, p352, p353, p354, p355, p356, p357)) {
            audit.record(p.getEmitterId(), Role.EMITTER, "PASSPORT_CREATED", "Passport", p.getId(),
                    AuditService.details("code", p.getPassportCode(), "totalVolumeTonnes", p.getTotalVolumeTonnes()));
        }

        // ---- Lab queue and history, split across the two accredited labs ----
        verification(id(6020), VerificationType.PASSPORT_COA, p350, null, 3, VerificationRequestStatus.APPROVED, LAB, "COA issued; measured 99.4% CO2", now.minus(29, ChronoUnit.DAYS), now.minus(28, ChronoUnit.DAYS));
        verification(id(6021), VerificationType.PASSPORT_COA, p351, null, 3, VerificationRequestStatus.APPROVED, EASTLAB, "COA issued; measured 93.8% CO2", now.minus(51, ChronoUnit.DAYS), now.minus(50, ChronoUnit.DAYS));
        verification(id(6022), VerificationType.PASSPORT_COA, p352, null, 3, VerificationRequestStatus.APPROVED, LAB, "COA issued; measured 97.6% CO2", now.minus(26, ChronoUnit.DAYS), now.minus(25, ChronoUnit.DAYS));
        verification(id(6023), VerificationType.PASSPORT_COA, p353, null, 3, VerificationRequestStatus.APPROVED, EASTLAB, "COA issued; measured 98.9% CO2", now.minus(11, ChronoUnit.DAYS), now.minus(10, ChronoUnit.DAYS));
        verification(id(6024), VerificationType.PASSPORT_COA, p354, null, 3, VerificationRequestStatus.REJECTED, LAB,
                "Rejected: measured 88.4% CO2 against a claimed 94.0%, with SOx an order of magnitude above the declared figure.", now.minus(30, ChronoUnit.DAYS), now.minus(28, ChronoUnit.DAYS));
        verification(id(6025), VerificationType.PASSPORT_COA, p355, null, 2, VerificationRequestStatus.IN_REVIEW, LAB, "Samples received; GC-MS run in progress", now.minus(30, ChronoUnit.HOURS), null);
        verification(id(6026), VerificationType.PASSPORT_COA, p356, null, 3, VerificationRequestStatus.APPROVED, LAB, "Previous COA cycle; due for re-test", now.minus(190, ChronoUnit.DAYS), now.minus(189, ChronoUnit.DAYS));
        verification(id(6027), VerificationType.PASSPORT_COA, p357, null, 3, VerificationRequestStatus.APPROVED, EASTLAB, "COA issued; measured 99.1% CO2", now.minus(18, ChronoUnit.DAYS), now.minus(17, ChronoUnit.DAYS));
        verification(id(6029), VerificationType.PASSPORT_COA, p351, null, 1, VerificationRequestStatus.QUEUED, null, "Routine half-yearly re-test; no dispute raised", now.minus(9, ChronoUnit.HOURS), null);
        notifications.notify(SUNDARGARH, "VERIFICATION_REJECTED", "CO2-IND-2026-000354 failed its COA",
                "The lab measured 88.4% CO2 against a claimed 94.0%. Fix the capture train and resubmit before listing this stream.", "VerificationRequest", id(6024));
        notifications.notify(EASTLAB, "VERIFICATION_QUEUED", "Re-test requested on CO2-IND-2026-000351",
                "Sundargarh Sponge Iron asked for the routine half-yearly re-test. Priority 1 - no listing is blocked.", "VerificationRequest", id(6029));
        notifications.notify(LAB, "VERIFICATION_QUEUED", "New passport awaiting COA",
                "CO2-IND-2026-000355 from Korba Valley Power Station is in review; the GC-MS run finishes today.", "VerificationRequest", id(6025));
        audit.record(LAB, Role.LAB, "VERIFICATION_REJECTED", "VerificationRequest", id(6024),
                AuditService.details("type", "PASSPORT_COA", "passport", "CO2-IND-2026-000354", "measuredConcentrationPct", 88.4));

        // ---- Listings ----
        // A second auction that is live the moment the demo starts.
        Listing l16 = auction(L16, p352, ListingStatus.LIVE, 80, 3600, 100, now.minus(5, ChronoUnit.MINUTES), 45,
                today.plusDays(4), today.plusDays(25), "Spot lot from the Korba capture train. Rising in ₹100 steps; last bid wins.", now.minus(2, ChronoUnit.DAYS));
        Listing l17 = auction(L17, p350, ListingStatus.SCHEDULED, 25, 4400, 100, now.plus(25, ChronoUnit.MINUTES), 30,
                today.plusDays(8), today.plusDays(28), "High-purity ammonia-plant CO2, 25 t spot lot.", now.minus(9, ChronoUnit.HOURS));
        // Ran and closed, but the emitter has not awarded it yet - the ENDED state.
        Listing l18 = auction(L18, p351, ListingStatus.ENDED, 30, 3300, 50, now.minus(2, ChronoUnit.HOURS), 30,
                today.plusDays(3), today.plusDays(18), "Gaseous spot lot, collection from Rourkela.", now.minus(3, ChronoUnit.DAYS));
        Listing l19 = listing(L19, p352, SaleMode.TENDER, ListingStatus.OPEN, 600, 3700, 96.0, null, today.plusDays(16), today.plusMonths(9), now.plus(9, ChronoUnit.DAYS),
                "600 t of liquefied CO2 from a pipeline-served power station. Split awards welcome.", now.minus(6, ChronoUnit.DAYS));
        Listing l20 = listing(L20, p353, SaleMode.TENDER, ListingStatus.OPEN, 350, 4050, 98.0, null, today.plusDays(22), today.plusMonths(8), now.plus(14, ChronoUnit.DAYS),
                "Refinery-grade CO2 from the hydrogen unit. Suits fuel synthesis and food-grade buyers.", now.minus(4, ChronoUnit.DAYS));
        Listing l21 = listing(L21, p350, SaleMode.TENDER, ListingStatus.OPEN, 200, 4500, 99.0, null, today.plusDays(10), today.plusMonths(6), now.plus(6, ChronoUnit.DAYS),
                "99.4% purity, beverage-grade after a single polishing step. Small lots considered.", now.minus(3, ChronoUnit.DAYS));
        Listing l22 = listing(L22, p351, SaleMode.TENDER, ListingStatus.AWARDED, 150, 3600, 93.0, null, today.minusDays(15), today.plusMonths(5), now.minus(18, ChronoUnit.DAYS),
                "Gaseous CO2 for algae cultivation.", now.minus(35, ChronoUnit.DAYS));
        Listing l23 = listing(L23, p352, SaleMode.TENDER, ListingStatus.AWARDED, 300, 3750, 96.0, null, today.plusDays(7), today.plusMonths(7), now.minus(5, ChronoUnit.DAYS),
                "Awarded to a precast-concrete buyer in Telangana.", now.minus(20, ChronoUnit.DAYS));
        // Closed after both proposals came in under the reserve - a real outcome worth showing.
        Listing l24 = listing(L24, p353, SaleMode.TENDER, ListingStatus.CLOSED, 100, 4700, 98.0, 4500.0, today.minusMonths(1), today.plusMonths(3), now.minus(16, ChronoUnit.DAYS),
                "Closed: both proposals came in below the ₹4500/t reserve.", now.minus(45, ChronoUnit.DAYS));
        Listing l25 = listing(L25, p350, SaleMode.TENDER, ListingStatus.CANCELLED, 120, 4400, 99.0, null, today.plusDays(14), today.plusMonths(5), now.minus(7, ChronoUnit.DAYS),
                "Cancelled: the purge-gas compressor was taken offline for an unplanned repair.", now.minus(21, ChronoUnit.DAYS));
        Listing l26 = auction(L26, p353, ListingStatus.CANCELLED, 40, 4200, 100, now.minus(1, ChronoUnit.DAYS), 30,
                today.plusDays(9), today.plusMonths(3), "Cancelled before it opened; the volume went to a long-term buyer instead.", now.minus(4, ChronoUnit.DAYS));
        Listing l27 = listing(L27, p357, SaleMode.TENDER, ListingStatus.OPEN, 250, 4350, 99.0, null, today.plusDays(19), today.plusMonths(7), now.plus(11, ChronoUnit.DAYS),
                "Line 2 purge gas, same specification as line 1. Monthly or bulk lifting both fine.", now.minus(1, ChronoUnit.DAYS));
        Listing l28 = auction(L28, p352, ListingStatus.AWARDED, 50, 3500, 100, now.minus(5, ChronoUnit.DAYS), 45,
                today.minusDays(3), today.plusMonths(3), "Spot lot (closed).", now.minus(6, ChronoUnit.DAYS));
        // A second auction waiting to be awarded, so the ENDED state is never a single row.
        Listing l29 = auction(L29, p357, ListingStatus.ENDED, 20, 4300, 100, now.minus(3, ChronoUnit.HOURS), 30,
                today.plusDays(6), today.plusMonths(4), "Line 2 spot lot, collection from Boisar.", now.minus(2, ChronoUnit.DAYS));
        l19.setDeliveryMonths(6); l19.setMonthlyTonnes(100.0); listings.save(l19);
        l16.setCurrentPricePerTonne(3900.0); l16.setCurrentLeaderId(SYNFUEL); listings.save(l16);
        l18.setCurrentPricePerTonne(3450.0); l18.setCurrentLeaderId(SPIRULINA); listings.save(l18);
        l28.setCurrentPricePerTonne(3800.0); l28.setCurrentLeaderId(PRECAST); listings.save(l28);
        l29.setCurrentPricePerTonne(4600.0); l29.setCurrentLeaderId(BEVGAS); listings.save(l29);
        for (Listing l : List.of(l16, l17, l18, l19, l20, l21, l22, l23, l24, l25, l26, l27, l28, l29)) {
            audit.record(l.getEmitterId(), Role.EMITTER, "LISTING_CREATED", "Listing", l.getId(),
                    AuditService.details("mode", l.getMode().name(), "volumeTonnes", l.getVolumeTonnes(), "basePricePerTonne", l.getBasePricePerTonne()));
        }
        audit.record(TARAPUR, Role.EMITTER, "LISTING_CANCELLED", "Listing", L25,
                AuditService.details("reason", "capture unit offline for repair", "releasedTonnes", 120));
        audit.record(THAR, Role.EMITTER, "LISTING_CLOSED", "Listing", L24,
                AuditService.details("reason", "all proposals below reserve", "reservePricePerTonne", 4500));

        // ---- Auction ladders ----
        bid(id(8010), L16, PRECAST, 3600, 80, now.minus(4, ChronoUnit.MINUTES));
        bid(id(8011), L16, SYNFUEL, 3700, 80, now.minus(3, ChronoUnit.MINUTES));
        bid(id(8012), L16, METHANOL, 3800, 80, now.minus(2, ChronoUnit.MINUTES));
        bid(id(8013), L16, SYNFUEL, 3900, 80, now.minus(1, ChronoUnit.MINUTES));
        bid(id(8014), L18, ALGAE, 3300, 30, now.minus(115, ChronoUnit.MINUTES));
        bid(id(8015), L18, METHANOL, 3350, 30, now.minus(108, ChronoUnit.MINUTES));
        bid(id(8016), L18, ALGAE, 3400, 30, now.minus(100, ChronoUnit.MINUTES));
        bid(id(8017), L18, SPIRULINA, 3450, 30, now.minus(95, ChronoUnit.MINUTES));
        bid(id(8018), L28, MALWA, 3500, 50, now.minus(5, ChronoUnit.DAYS).plus(4, ChronoUnit.MINUTES));
        bid(id(8019), L28, PRECAST, 3650, 50, now.minus(5, ChronoUnit.DAYS).plus(12, ChronoUnit.MINUTES));
        bid(id(8020), L28, PRECAST, 3800, 50, now.minus(5, ChronoUnit.DAYS).plus(26, ChronoUnit.MINUTES));
        bid(id(8021), L29, SPIRULINA, 4300, 20, now.minus(175, ChronoUnit.MINUTES));
        bid(id(8022), L29, BEVGAS, 4400, 20, now.minus(168, ChronoUnit.MINUTES));
        bid(id(8023), L29, SPIRULINA, 4500, 20, now.minus(160, ChronoUnit.MINUTES));
        bid(id(8024), L29, BEVGAS, 4600, 20, now.minus(155, ChronoUnit.MINUTES));
        notifications.notify(KORBA, "BID_RECEIVED", "New bid on CO2-IND-2026-000352",
                "A bidder raised the auction to ₹3900/t for 80 t.", "Listing", L16);
        notifications.notify(METHANOL, "OUTBID", "You have been outbid on CO2-IND-2026-000352",
                "The bid is now ₹3900/t. Bid ₹4000/t to lead again.", "Listing", L16);
        notifications.notify(PRECAST, "OUTBID", "You have been outbid on CO2-IND-2026-000352",
                "The bid is now ₹3900/t. Bid ₹4000/t to lead again.", "Listing", L16);
        notifications.notify(SUNDARGARH, "AUCTION_ENDED", "Auction closed on CO2-IND-2026-000351",
                "The 30 t lot ended at ₹3450/t after four bids. Award it to the leading bidder to create the agreement.", "Listing", L18);
        notifications.notify(TARAPUR, "AUCTION_ENDED", "Auction closed on CO2-IND-2026-000357",
                "The 20 t line-2 lot ended at ₹4600/t after four bids. Award it to the leading bidder to create the agreement.", "Listing", L29);

        // ---- Proposals: every open tender above has competition ----
        proposal(id(2020), l19, p352, SYNFUEL, 300, 96.0, 12, "Monthly by rail to Mathura", 3800, true, null, ProposalStatus.SUBMITTED, now.minus(5, ChronoUnit.DAYS));
        proposal(id(2021), l19, p352, PRECAST, 250, 96.0, 6, "Fortnightly by road", 3750, true, null, ProposalStatus.SUBMITTED, now.minus(4, ChronoUnit.DAYS));
        proposal(id(2022), l19, p352, CONCRETE, 600, 96.0, 4, "Single bulk lift", 3720, false, "Needs a 45-day collection window", ProposalStatus.SUBMITTED, now.minus(3, ChronoUnit.DAYS));
        proposal(id(2023), l19, p352, ALGAE, 300, 96.0, 9, "Rail to Paradip", 3760, true, null, ProposalStatus.SUBMITTED, now.minus(2, ChronoUnit.DAYS));
        proposal(id(2024), l19, p352, UREA, 200, 96.0, 12, "Monthly by rail", 3780, true, null, ProposalStatus.SUBMITTED, now.minus(30, ChronoUnit.HOURS));
        proposal(id(2025), l19, p352, MALWA, 100, 96.0, 6, "Monthly by road", 3650, false, null, ProposalStatus.WITHDRAWN, now.minus(6, ChronoUnit.DAYS));
        proposal(id(2026), l20, p353, METHANOL, 350, 98.0, 12, "Rail to Dahej", 4150, true, null, ProposalStatus.SUBMITTED, now.minus(3, ChronoUnit.DAYS));
        proposal(id(2027), l20, p353, SYNFUEL, 200, 98.0, 9, "Monthly by rail", 4100, true, null, ProposalStatus.SUBMITTED, now.minus(40, ChronoUnit.HOURS));
        proposal(id(2028), l20, p353, PRECAST, 150, 98.0, 6, "Road, fortnightly", 4080, true, null, ProposalStatus.SUBMITTED, now.minus(22, ChronoUnit.HOURS));
        proposal(id(2029), l20, p353, UREA, 120, 98.0, 12, "Coastal shipping to Ratnagiri", 4150, true, null, ProposalStatus.SUBMITTED, now.minus(14, ChronoUnit.HOURS));
        proposal(id(2030), l21, p350, BEVGAS, 120, 99.0, 12, "Weekly ISO tanks to Hosur", 4700, true, "Food-grade handling; ISBT certificate required", ProposalStatus.SUBMITTED, now.minus(2, ChronoUnit.DAYS));
        proposal(id(2031), l21, p350, SPIRULINA, 80, 99.0, 6, "Monthly by road", 4600, true, null, ProposalStatus.SUBMITTED, now.minus(26, ChronoUnit.HOURS));
        proposal(id(2032), l21, p350, MALWA, 80, 99.0, 6, "Monthly by road", 4400, false, null, ProposalStatus.SUBMITTED, now.minus(10, ChronoUnit.HOURS));
        proposal(id(2033), l21, p350, GREENHOUSE, 60, 99.0, 9, "Monthly by road", 4500, true, null, ProposalStatus.SUBMITTED, now.minus(5, ChronoUnit.HOURS));
        proposal(id(2034), l27, p357, UREA, 150, 99.0, 12, "Monthly by rail", 4400, true, null, ProposalStatus.SUBMITTED, now.minus(20, ChronoUnit.HOURS));
        proposal(id(2035), l27, p357, BEVGAS, 100, 99.0, 6, "Weekly ISO tanks", 4450, true, null, ProposalStatus.SUBMITTED, now.minus(12, ChronoUnit.HOURS));
        proposal(id(2036), l27, p357, CONCRETE, 200, 99.0, 4, "Bulk lift", 4300, false, null, ProposalStatus.SUBMITTED, now.minus(4, ChronoUnit.HOURS));
        // More competition on the tenders the original seed left thin.
        // L1 is deliberately left at its three proposals: the smoke test pins that count.
        Listing l3 = listings.findById(L3).orElseThrow();
        Listing l10 = listings.findById(L10).orElseThrow();
        Listing l11 = listings.findById(L11).orElseThrow();
        Co2Passport p344 = passports.findById(P344).orElseThrow();
        Co2Passport p346 = passports.findById(P346).orElseThrow();
        Co2Passport p347 = passports.findById(P347).orElseThrow();
        proposal(id(2037), l27, p357, MALWA, 120, 99.0, 9, "Monthly by rail to Indore", 4350, true, null, ProposalStatus.SUBMITTED, now.minus(36, ChronoUnit.HOURS));
        proposal(id(2038), l21, p350, PRECAST, 150, 99.0, 12, "Road, fortnightly", 4550, true, "Beverage-grade polishing not required", ProposalStatus.SUBMITTED, now.minus(18, ChronoUnit.HOURS));
        proposal(id(2039), l3, p344, SYNFUEL, 400, 97.0, 12, "Rail to Mathura", 3850, true, null, ProposalStatus.SUBMITTED, now.minus(2, ChronoUnit.DAYS));
        proposal(id(2040), l3, p344, PRECAST, 300, 97.0, 6, "Road, monthly", 3820, true, null, ProposalStatus.SUBMITTED, now.minus(28, ChronoUnit.HOURS));
        proposal(id(2041), l3, p344, SPIRULINA, 200, 97.0, 9, "Rail to Coimbatore", 3830, true, null, ProposalStatus.SUBMITTED, now.minus(16, ChronoUnit.HOURS));
        proposal(id(2042), l10, p346, SPIRULINA, 100, 94.0, 6, "Monthly by rail", 4250, true, null, ProposalStatus.SUBMITTED, now.minus(22, ChronoUnit.HOURS));
        proposal(id(2043), l11, p347, BEVGAS, 150, 98.0, 12, "Weekly ISO tanks to Hosur", 4050, true, null, ProposalStatus.SUBMITTED, now.minus(15, ChronoUnit.HOURS));
        proposal(id(2044), l11, p347, SYNFUEL, 200, 98.0, 9, "Rail to Mathura", 3980, true, null, ProposalStatus.SUBMITTED, now.minus(8, ChronoUnit.HOURS));
        proposal(id(2049), l11, p347, MALWA, 100, 98.0, 6, "Monthly by road", 3880, false, null, ProposalStatus.WITHDRAWN, now.minus(3, ChronoUnit.DAYS));
        // Rejected on the closed tender, awarded on the two awarded ones.
        proposal(id(2045), l24, p353, MALWA, 100, 98.0, 6, "Monthly by road", 4200, false, null, ProposalStatus.REJECTED, now.minus(40, ChronoUnit.DAYS));
        proposal(id(2046), l24, p353, CONCRETE, 100, 98.0, 4, "Bulk lift", 4300, false, null, ProposalStatus.REJECTED, now.minus(38, ChronoUnit.DAYS));
        Proposal pr22 = proposal(id(2047), l22, p351, SPIRULINA, 150, 93.0, 5, "Rail to Coimbatore", 3600, true, null, ProposalStatus.AWARDED, now.minus(30, ChronoUnit.DAYS));
        Proposal pr23 = proposal(id(2048), l23, p352, PRECAST, 300, 96.0, 7, "Road, fortnightly", 3800, true, null, ProposalStatus.AWARDED, now.minus(16, ChronoUnit.DAYS));
        notifications.notify(KORBA, "PROPOSAL_RECEIVED", "Five proposals on CO2-IND-2026-000352",
                "600 t tender: the combined partial bids are worth more than the single full-volume offer. Compare them on the tender page.", "Listing", L19);
        notifications.notify(TARAPUR, "PROPOSAL_RECEIVED", "New tender proposal on CO2-IND-2026-000350",
                "Palar Valley Beverage Gases (SILVER) offers ₹4700/t for 120 t.", "Listing", L21);
        notifications.notify(THAR, "PROPOSAL_RECEIVED", "New tender proposal on CO2-IND-2026-000353",
                "Gujarat Methanol Synthesis (GOLD) offers ₹4150/t for 350 t.", "Listing", L20);
        notifications.notify(MALWA, "PROPOSAL_REJECTED", "Proposal not accepted on CO2-IND-2026-000353",
                "The tender closed without an award: every offer was below the ₹4500/t reserve.", "Listing", L24);

        // ---- Agreements ----
        Agreement ay1 = agreement(id(3018), l22, pr22, null, SUNDARGARH, SPIRULINA, p351, SaleMode.TENDER, 150, 3600, AgreementStatus.ACTIVE,
                today.minusDays(15), today.plusMonths(5), 5, null, 10.0, false, 10.0, PricingStructure.FIXED, now.minus(30, ChronoUnit.DAYS));
        Agreement ay2 = agreement(id(3019), l23, pr23, null, KORBA, PRECAST, p352, SaleMode.TENDER, 300, 3800, AgreementStatus.PENDING_VERIFICATION,
                today.plusDays(7), today.plusMonths(7), 7, null, 10.0, false, 10.0, PricingStructure.FIXED, now.minus(5, ChronoUnit.DAYS));
        // Already picked up by a lab: the second IN_REVIEW row, so that filter is never a single line.
        verification(id(6028), VerificationType.SALE_APPROVAL, p352, ay2, 4, VerificationRequestStatus.IN_REVIEW, LAB,
                "Sale approval: 300 t of CO2-IND-2026-000352 to Warangal Precast Blocks. Sample drawn; results due tomorrow.", now.minus(5, ChronoUnit.DAYS), null);
        verification(id(6031), VerificationType.SALE_APPROVAL, p351, ay1, 4, VerificationRequestStatus.APPROVED, EASTLAB,
                "Sale approved; specification matched the Passport", now.minus(30, ChronoUnit.DAYS), now.minus(29, ChronoUnit.DAYS));
        notifications.notify(PRECAST, "TENDER_AWARDED", "Tender awarded: CO2-IND-2026-000352",
                "Korba Valley Power Station awarded you 300 t at ₹3800/t. The sale is queued for independent lab approval.", "Agreement", id(3019));
        notifications.notify(KORBA, "VERIFICATION_CLAIMED", "Sale approval in review",
                "National CO2 Testing Lab drew a sample against the 300 t sale on CO2-IND-2026-000352. Results are due tomorrow.", "VerificationRequest", id(6028));
        notifications.notify(SPIRULINA, "TENDER_AWARDED", "Tender awarded: CO2-IND-2026-000351",
                "Sundargarh Sponge Iron awarded you 150 t at ₹3600/t. The agreement is active; shipments can be scheduled.", "Agreement", id(3018));
        audit.record(SUNDARGARH, Role.EMITTER, "LISTING_AWARDED", "Listing", L22, AuditService.details("proposal", id(2047), "agreement", id(3018), "volumeTonnes", 150));
        audit.record(KORBA, Role.EMITTER, "LISTING_AWARDED", "Listing", L23, AuditService.details("proposal", id(2048), "agreement", id(3019), "volumeTonnes", 300));

        // Auction winner on L28.
        agreement(id(3031), l28, null, null, KORBA, PRECAST, p352, SaleMode.AUCTION, 50, 3800, AgreementStatus.ACTIVE,
                today.minusDays(3), today.plusMonths(3), 1, null, 10.0, false, null, PricingStructure.FIXED, now.minus(5, ChronoUnit.DAYS));
        notifications.notify(PRECAST, "AUCTION_WON", "Auction won: CO2-IND-2026-000352",
                "You placed the last bid at ₹3800/t for 50 t (₹1,90,000 total). This purchase is binding.", "Agreement", id(3031));
        audit.record(KORBA, Role.EMITTER, "AUCTION_WON", "Listing", L28,
                AuditService.details("winner", PRECAST, "agreement", id(3031), "finalPricePerTonne", 3800, "volumeTonnes", 50, "bidCount", 3));

        // A cancelled contract and a sale the lab turned down: both CANCELLED, for different reasons.
        Agreement ay3 = agreement(id(3027), null, null, null, THAR, SYNFUEL, p353, SaleMode.CONTRACT, 300, 4000, AgreementStatus.CANCELLED,
                today.minusMonths(5), today.minusMonths(2), 3, 100.0, 10.0, false, 10.0, PricingStructure.FIXED, now.minus(155, ChronoUnit.DAYS));
        ay3.setCancelledByCompanyId(SYNFUEL);
        ay3.setCancelReason("Synfuel unit commissioning slipped two quarters; the buyer released the volume rather than take-or-pay.");
        ay3.setUpdatedAt(now.minus(110, ChronoUnit.DAYS));
        agreements.save(ay3);
        audit.record(SYNFUEL, Role.UTILIZER, "AGREEMENT_CANCELLED", "Agreement", id(3027),
                AuditService.details("volumeTonnes", 300, "reason", "Buyer commissioning delayed"));
        notifications.notify(THAR, "AGREEMENT_CANCELLED", "Contract cancelled by the buyer",
                "Yamuna Synfuels cancelled a 300 t contract before expiry. The volume has been returned to free stock.", "Agreement", id(3027));

        Agreement ay4 = agreement(id(3030), null, null, null, THAR, MALWA, p353, SaleMode.TENDER, 60, 4650, AgreementStatus.CANCELLED,
                today.minusMonths(2), today.plusMonths(2), 4, null, 10.0, false, 10.0, PricingStructure.FIXED, now.minus(62, ChronoUnit.DAYS));
        ay4.setCancelReason("Lab rejected the sale: the sampled specification did not match the Passport. Volume released, no trust penalty.");
        ay4.setUpdatedAt(now.minus(59, ChronoUnit.DAYS));
        agreements.save(ay4);
        verification(id(6030), VerificationType.SALE_APPROVAL, p353, ay4, 4, VerificationRequestStatus.REJECTED, EASTLAB,
                "Rejected: the delivered sample read 96.1% against the 98.9% on the Passport.", now.minus(61, ChronoUnit.DAYS), now.minus(59, ChronoUnit.DAYS));
        audit.record(EASTLAB, Role.LAB, "VERIFICATION_REJECTED", "VerificationRequest", id(6030),
                AuditService.details("type", "SALE_APPROVAL", "agreement", id(3030)));
        notifications.notify(MALWA, "VERIFICATION_REJECTED", "Sale rejected by the lab",
                "The sample on CO2-IND-2026-000353 did not match the Passport. The agreement was cancelled and no penalty applies to you.", "Agreement", id(3030));

        // Completed history, spread over 20 months so the regulator's monthly curve has a shape.
        agreement(id(3022), null, null, null, THAR, METHANOL, p353, SaleMode.TENDER, 400, 3900, AgreementStatus.COMPLETED,
                today.minusMonths(13), today.minusMonths(7), 6, null, 10.0, false, null, PricingStructure.FIXED, now.minus(400, ChronoUnit.DAYS));
        agreement(id(3023), null, null, null, TARAPUR, SPIRULINA, p350, SaleMode.TENDER, 400, 4400, AgreementStatus.COMPLETED,
                today.minusMonths(8), today.minusMonths(5), 3, null, 10.0, false, null, PricingStructure.FIXED, now.minus(250, ChronoUnit.DAYS));
        agreement(id(3024), null, null, null, SUNDARGARH, CONCRETE, p351, SaleMode.TENDER, 750, 3550, AgreementStatus.COMPLETED,
                today.minusMonths(16), today.minusMonths(10), 6, null, 10.0, false, null, PricingStructure.FIXED, now.minus(490, ChronoUnit.DAYS));
        agreement(id(3025), null, null, null, KORBA, UREA, p352, SaleMode.CONTRACT, 1100, 3650, AgreementStatus.COMPLETED,
                today.minusMonths(12), today.minusMonths(6), 6, 183.33, 10.0, true, 10.0, PricingStructure.FIXED, now.minus(370, ChronoUnit.DAYS));
        agreement(id(3026), null, null, null, KORBA, CONCRETE, p352, SaleMode.TENDER, 900, 3700, AgreementStatus.COMPLETED,
                today.minusMonths(6), today.minusMonths(3), 3, null, 10.0, false, null, PricingStructure.FIXED, now.minus(190, ChronoUnit.DAYS));
        agreement(id(3028), null, null, null, DECCANREF, SPIRULINA, p347, SaleMode.TENDER, 1200, 3800, AgreementStatus.COMPLETED,
                today.minusMonths(18), today.minusMonths(12), 6, null, 10.0, false, null, PricingStructure.FIXED, now.minus(550, ChronoUnit.DAYS));
        agreement(id(3029), null, null, null, KORBA, METHANOL, p352, SaleMode.CONTRACT, 2600, 3600, AgreementStatus.COMPLETED,
                today.minusMonths(20), today.minusMonths(14), 6, 433.33, 10.0, true, 10.0, PricingStructure.FIXED, now.minus(610, ChronoUnit.DAYS));

        // The negotiated contracts have to exist before the shipments that run against them.
        seedNegotiationThreads(now, today);
        seedWiderShipments(now, today);

        // ---- Allocation: only OPEN/SCHEDULED/LIVE listings and live agreements hold volume ----
        // 350 (800 t): L21 200 + L17 auction 25 + negotiated contract 240 = 465 locked, 335 free.
        // (L25 was cancelled, so its 120 t went back to free stock.)
        p350.setAllocatedTonnes(465); passports.save(p350);
        // 351 (600 t): L18 auction 30 + active agreement 150 = 180 locked.
        p351.setAllocatedTonnes(180); passports.save(p351);
        // 352 (2000 t): L16 80 + L19 600 + awaiting-lab 300 + auction win 50 + contract 600 = 1630 locked.
        p352.setAllocatedTonnes(1630); passports.save(p352);
        // 353 (900 t): L20 350 only; the closed, cancelled and lab-rejected deals all released theirs.
        p353.setAllocatedTonnes(350); passports.save(p353);
        // 357 (500 t): L27 250 + the ended L29 auction 20 = 270 locked.
        p357.setAllocatedTonnes(270); passports.save(p357);
        // A rejected, an in-review and a lapsed passport can hold nothing.
        p354.setAllocatedTonnes(0); passports.save(p354);
        p355.setAllocatedTonnes(0); passports.save(p355);
        p356.setAllocatedTonnes(0); passports.save(p356);

        // ---- A third forecast, on the busiest passport ----
        OutputForecast f3 = new OutputForecast();
        f3.setId(id(7003)); f3.setPassportId(P352); f3.setPeriodStart(today.plusDays(35)); f3.setPeriodEnd(today.plusDays(44));
        f3.setExpectedTonnesPerDay(40); f3.setReason("Unit 2 turbine overhaul");
        forecasts.save(f3);
        int notified3 = passportService.notifyShortfall(f3, p352);
        audit.record(KORBA, Role.EMITTER, "FORECAST_ADDED", "Passport", P352,
                AuditService.details("expectedTonnesPerDay", 40, "utilizersNotified", notified3));

        // Emitter badges band on cumulative tonnes sold, so re-read them now the agreements exist.
        trust.refreshBadge(TARAPUR, SUNDARGARH, KORBA, THAR, DECCANREF);

        notifications.notify(REGULATOR, "COMPLIANCE_ALERT", "Reconciliation failures across three lanes",
                "A weight gap on Rourkela → Coimbatore and a meter mismatch on Korba → Mathura joined the two flagged runs already open. Drill into each company for the loading and delivery records.", "Company", KORBA);
        notifications.notify(REGULATOR, "COMPLIANCE_ALERT", "A passport failed its Certificate of Analysis",
                "CO2-IND-2026-000354 from Sundargarh Sponge Iron measured 88.4% CO2 against a claimed 94.0%. No volume was ever listed against it.", "Company", SUNDARGARH);
        seedPendingSignups();

        notifications.notify(ADMIN, "PLATFORM_SUMMARY", "Demo dataset loaded",
                "30 companies across 12 states, 16 CO2 Passports, 28 listings and 10 negotiation threads are live. Every workflow state has at least two examples.", "Company", ADMIN);
    }

    // =====================================================================================
    // Approvals queue
    // -------------------------------------------------------------------------------------
    // Six more sign-ups waiting on the admin, on top of Bharat Bio-CO2 Ltd and Coastal Carbon
    // Recovery, spread across four roles and six states the rest of the seed does not use.
    // They are deliberately left un-actioned: approving or rejecting them is the demo.
    // Each account is real, so it starts working the moment the admin approves the company -
    // until then AuthService refuses the login with "Company approval pending", by design.
    // =====================================================================================
    private void seedPendingSignups() {
        pendingSignup(PARASNATH, "Parasnath Coke & Chemicals", Role.EMITTER, Sector.STEEL, "Dhanbad", "Jharkhand",
                23.80, 86.43, "parasnath@carbon.local", "Anirban Ghosh", 13,
                "Coke-oven gas, 35 t/day claimed. Oldest item in the queue - the site visit is still outstanding.");
        pendingSignup(BRAHMAPUTRA, "Brahmaputra Petro Refining", Role.EMITTER, Sector.REFINERY, "Dibrugarh", "Assam",
                27.47, 94.91, "brahmaputra@carbon.local", "Jyotirmoy Baruah", 9,
                "Hydrogen-unit off-gas at 99% purity. Registration papers received; awaiting the capacity call.");
        pendingSignup(SUNDARBAN, "Sundarban Algal Biotech", Role.UTILIZER, Sector.ALGAE, "Kolkata", "West Bengal",
                22.57, 88.36, "sundarban@carbon.local", "Rupa Chatterjee", 6,
                "Open-pond algae cultivation, 3,000 t/year demand. First buyer from the east coast.");
        pendingSignup(DOABA, "Doaba Protected Farms", Role.UTILIZER, Sector.GREENHOUSE, "Jalandhar", "Punjab",
                31.33, 75.58, "doaba@carbon.local", "Harpreet Sandhu", 4,
                "Poly-house enrichment across 40 acres. Wants a winter-season offtake.");
        pendingSignup(GTCRYO, "Grand Trunk Cryo Logistics", Role.TRANSPORT, Sector.LOGISTICS, "Ambala", "Haryana",
                30.38, 76.78, "gtcryo@carbon.local", "Vikram Chaudhary", 2,
                "Eight cryogenic tankers on the northern corridor. Fleet documents attached.");
        pendingSignup(HIMALAB, "Himalayan Gas Testing Services", Role.LAB, Sector.LAB, "Dehradun", "Uttarakhand",
                30.32, 78.03, "himalab@carbon.local", "Dr. Neha Rawat", 1,
                "NABL ISO/IEC 17025 applied for. Newest application - accreditation certificate still to be checked.");
    }

    /**
     * One sign-up still waiting on the admin: creates the company and its login, ages the
     * registration so the queue has a believable order, and raises both notifications - one to
     * the admin who has to act, one to the applicant who is waiting.
     */
    private void pendingSignup(UUID id, String name, Role role, Sector sector, String city, String state,
                               double lat, double lng, String email, String contact, int daysAgo, String note) {
        company(id, name, role, sector, city, state, lat, lng, email, contact, CompanyStatus.PENDING);
        companies.findById(id).ifPresent(c -> {
            c.setCreatedAt(Instant.now().minus(daysAgo, ChronoUnit.DAYS));
            companies.save(c);
        });
        trust.getOrCreate(id);
        notifications.notify(ADMIN, "SIGNUP_PENDING", "New sign-up awaiting verification",
                String.format("%s registered as %s from %s, %s. %s Verify the company (form review + call/visit) before approving.",
                        name, role.name(), city, state, note), "Company", id);
        notifications.notify(id, "SIGNUP_PENDING", "Your registration is under review",
                String.format("Thanks for registering %s. The platform team verifies every new company before it can trade; you will be notified as soon as the review is done.",
                        name), "Company", id);
        audit.record(id, role, "COMPANY_REGISTERED", "Company", id,
                AuditService.details("name", name, "role", role.name(), "city", city, "state", state));
    }

    /** Shipments and carrier offers for the wider set: all five states, all four flag rules, four carriers. */
    private void seedWiderShipments(Instant now, LocalDate today) {
        double rklToCbe = GeoUtil.distanceKm(22.26, 84.85, 11.02, 76.96);
        double krbToMtr = GeoUtil.distanceKm(22.35, 82.68, 27.49, 77.67);
        double boiToHos = GeoUtil.distanceKm(19.80, 72.75, 12.74, 77.83);
        double angToPdp = GeoUtil.distanceKm(20.84, 85.10, 20.32, 86.61);
        double satToRtg = GeoUtil.distanceKm(24.57, 80.83, 16.99, 73.30);
        double puneHop = GeoUtil.distanceKm(22.26, 84.85, 18.52, 73.86);
        double hydHop = GeoUtil.distanceKm(22.35, 82.68, 17.38, 78.49);

        // 1. Weight gap only: same seal, matching meter, but 2.4 t of 45 never arrived.
        Shipment y1 = shipment(id(5015), id(3018), SAHYADRI, TransportMode.RAIL, rklToCbe, 45,
                22.26, 84.85, 11.02, 76.96, now.minus(11, ChronoUnit.DAYS));
        y1.setSealNumber("SEAL-6204"); y1.setLoadedWeightTonnes(45.0); y1.setLoadMeterReading(50000.0);
        y1.setLoadSamplePurityPct(93.8); y1.setLoadedAt(now.minus(10, ChronoUnit.DAYS));
        y1.setDeliverySealNumber("SEAL-6204"); y1.setDeliveredWeightTonnes(42.6); y1.setDeliveryMeterReading(50045.0);
        y1.setDeliverySamplePurityPct(93.7); y1.setDeliveredAt(now.minus(8, ChronoUnit.DAYS));
        y1.setFlags(ReconciliationRules.evaluate(new ReconciliationRules.Input(
                "SEAL-6204", "SEAL-6204", 45.0, 42.6, 93.8, 93.7, 50000.0, 50045.0, 2.0)));
        y1.setStatus(y1.getFlags().isEmpty() ? ShipmentStatus.DELIVERED : ShipmentStatus.FLAGGED);
        y1.setTransportCost(rklToCbe * 45 * 2.5 + 15000);
        shipments.save(y1);
        transportOffer(id(5120), id(5015), SAHYADRI, TransportOfferStatus.ACCEPTED, puneHop, y1.getTransportCost(), now.minus(11, ChronoUnit.DAYS));
        audit.record(SPIRULINA, Role.UTILIZER, "SHIPMENT_FLAGGED", "Shipment", id(5015),
                AuditService.details("loadedWeightTonnes", 45.0, "deliveredWeightTonnes", 42.6, "flags", y1.getFlags()));
        notifications.notify(SUNDARGARH, "SHIPMENT_FLAGGED", "Shipment flagged on delivery",
                "45 t left Rourkela and 42.6 t arrived at Coimbatore, a 5.3% gap against a 2% tolerance. The seal was intact, so the loss is in the rail leg.", "Shipment", id(5015));
        notifications.notify(SAHYADRI, "SHIPMENT_FLAGGED", "Your delivery was flagged",
                "A 5.3% weight gap on the Rourkela → Coimbatore run. The lab has been notified.", "Shipment", id(5015));

        // 2. Meter mismatch only: the delivery meter says 40 t moved but the weighbridge said 30.
        Shipment y2 = shipment(id(5016), id(3021), DECTRANS, TransportMode.RAIL, krbToMtr, 30,
                22.35, 82.68, 27.49, 77.67, now.minus(9, ChronoUnit.DAYS));
        y2.setSealNumber("SEAL-6318"); y2.setLoadedWeightTonnes(30.0); y2.setLoadMeterReading(61000.0);
        y2.setLoadSamplePurityPct(97.6); y2.setLoadedAt(now.minus(8, ChronoUnit.DAYS));
        y2.setDeliverySealNumber("SEAL-6318"); y2.setDeliveredWeightTonnes(29.7); y2.setDeliveryMeterReading(61040.0);
        y2.setDeliverySamplePurityPct(97.4); y2.setDeliveredAt(now.minus(6, ChronoUnit.DAYS));
        y2.setFlags(ReconciliationRules.evaluate(new ReconciliationRules.Input(
                "SEAL-6318", "SEAL-6318", 30.0, 29.7, 97.6, 97.4, 61000.0, 61040.0, 2.0)));
        y2.setStatus(y2.getFlags().isEmpty() ? ShipmentStatus.DELIVERED : ShipmentStatus.FLAGGED);
        y2.setTransportCost(krbToMtr * 30 * 2.5 + 15000);
        shipments.save(y2);
        transportOffer(id(5121), id(5016), DECTRANS, TransportOfferStatus.ACCEPTED, hydHop, y2.getTransportCost(), now.minus(9, ChronoUnit.DAYS));
        audit.record(SYNFUEL, Role.UTILIZER, "SHIPMENT_FLAGGED", "Shipment", id(5016),
                AuditService.details("loadMeterReading", 61000.0, "deliveryMeterReading", 61040.0, "flags", y2.getFlags()));
        notifications.notify(KORBA, "SHIPMENT_FLAGGED", "Shipment flagged on delivery",
                "The meters across the Korba → Mathura run differ by 40 t while the weighbridge recorded 30 t. Reconciliation failed on the meter reading.", "Shipment", id(5016));

        // 3-5. Clean deliveries, so the flagged ones are the exception rather than the rule.
        Shipment y3 = shipment(id(5017), id(3020), SAHYADRI, TransportMode.TRUCK, boiToHos, 20,
                19.80, 72.75, 12.74, 77.83, now.minus(16, ChronoUnit.DAYS));
        y3.setSealNumber("SEAL-6401"); y3.setLoadedWeightTonnes(20.0); y3.setLoadMeterReading(30100.0);
        y3.setLoadSamplePurityPct(99.4); y3.setLoadedAt(now.minus(15, ChronoUnit.DAYS));
        y3.setDeliverySealNumber("SEAL-6401"); y3.setDeliveredWeightTonnes(19.8); y3.setDeliveryMeterReading(30120.0);
        y3.setDeliverySamplePurityPct(99.3); y3.setDeliveredAt(now.minus(14, ChronoUnit.DAYS));
        y3.setFlags(ReconciliationRules.evaluate(new ReconciliationRules.Input(
                "SEAL-6401", "SEAL-6401", 20.0, 19.8, 99.4, 99.3, 30100.0, 30120.0, 2.0)));
        y3.setStatus(y3.getFlags().isEmpty() ? ShipmentStatus.DELIVERED : ShipmentStatus.FLAGGED);
        y3.setTransportCost(boiToHos * 20 * 4.0 + 5000);
        shipments.save(y3);
        transportOffer(id(5122), id(5017), SAHYADRI, TransportOfferStatus.ACCEPTED, GeoUtil.distanceKm(19.80, 72.75, 18.52, 73.86), y3.getTransportCost(), now.minus(16, ChronoUnit.DAYS));
        transportOffer(id(5123), id(5017), GUJTRANS, TransportOfferStatus.REJECTED, GeoUtil.distanceKm(19.80, 72.75, 22.47, 70.06), null, now.minus(16, ChronoUnit.DAYS));
        audit.record(BEVGAS, Role.UTILIZER, "SHIPMENT_DELIVERED", "Shipment", id(5017),
                AuditService.details("deliverySeal", "SEAL-6401", "deliveredWeightTonnes", 19.8, "flags", y3.getFlags()));
        notifications.notify(BEVGAS, "SHIPMENT_DELIVERED", "Delivery reconciled",
                "20 t from Boisar arrived at Hosur with the seal intact and purity within tolerance. Nothing to action.", "Shipment", id(5017));

        Shipment y4 = shipment(id(5018), id(3021), DECTRANS, TransportMode.RAIL, krbToMtr, 50,
                22.35, 82.68, 27.49, 77.67, now.minus(28, ChronoUnit.DAYS));
        y4.setSealNumber("SEAL-6290"); y4.setLoadedWeightTonnes(50.0); y4.setLoadMeterReading(60400.0);
        y4.setLoadSamplePurityPct(97.6); y4.setLoadedAt(now.minus(27, ChronoUnit.DAYS));
        y4.setDeliverySealNumber("SEAL-6290"); y4.setDeliveredWeightTonnes(49.4); y4.setDeliveryMeterReading(60450.0);
        y4.setDeliverySamplePurityPct(97.5); y4.setDeliveredAt(now.minus(25, ChronoUnit.DAYS));
        y4.setFlags(ReconciliationRules.evaluate(new ReconciliationRules.Input(
                "SEAL-6290", "SEAL-6290", 50.0, 49.4, 97.6, 97.5, 60400.0, 60450.0, 2.0)));
        y4.setStatus(y4.getFlags().isEmpty() ? ShipmentStatus.DELIVERED : ShipmentStatus.FLAGGED);
        y4.setTransportCost(krbToMtr * 50 * 2.5 + 15000);
        shipments.save(y4);
        transportOffer(id(5124), id(5018), DECTRANS, TransportOfferStatus.ACCEPTED, hydHop, y4.getTransportCost(), now.minus(28, ChronoUnit.DAYS));

        Shipment y5 = shipment(id(5025), id(3010), DECTRANS, TransportMode.RAIL, satToRtg, 35,
                24.57, 80.83, 16.99, 73.30, now.minus(35, ChronoUnit.DAYS));
        y5.setSealNumber("SEAL-6033"); y5.setLoadedWeightTonnes(35.0); y5.setLoadMeterReading(40200.0);
        y5.setLoadSamplePurityPct(95.9); y5.setLoadedAt(now.minus(34, ChronoUnit.DAYS));
        y5.setDeliverySealNumber("SEAL-6033"); y5.setDeliveredWeightTonnes(34.7); y5.setDeliveryMeterReading(40235.0);
        y5.setDeliverySamplePurityPct(95.8); y5.setDeliveredAt(now.minus(32, ChronoUnit.DAYS));
        y5.setFlags(ReconciliationRules.evaluate(new ReconciliationRules.Input(
                "SEAL-6033", "SEAL-6033", 35.0, 34.7, 95.9, 95.8, 40200.0, 40235.0, 2.0)));
        y5.setStatus(y5.getFlags().isEmpty() ? ShipmentStatus.DELIVERED : ShipmentStatus.FLAGGED);
        y5.setTransportCost(satToRtg * 35 * 2.5 + 15000);
        shipments.save(y5);
        transportOffer(id(5134), id(5025), DECTRANS, TransportOfferStatus.ACCEPTED, GeoUtil.distanceKm(24.57, 80.83, 17.38, 78.49), y5.getTransportCost(), now.minus(35, ChronoUnit.DAYS));
        transportOffer(id(5135), id(5025), SAHYADRI, TransportOfferStatus.REJECTED, GeoUtil.distanceKm(24.57, 80.83, 18.52, 73.86), null, now.minus(35, ChronoUnit.DAYS));

        // 6. Own transport: the buyer collected it themselves, so no carrier offer exists.
        Shipment y6 = shipment(id(5022), A_L4_ALGAE, null, TransportMode.TRUCK, angToPdp, 30,
                20.84, 85.10, 20.32, 86.61, now.minus(40, ChronoUnit.DAYS));
        y6.setOwnTransport(true);
        y6.setSealNumber("SEAL-5912"); y6.setLoadedWeightTonnes(30.0); y6.setLoadMeterReading(119800.0);
        y6.setLoadSamplePurityPct(94.5); y6.setLoadedAt(now.minus(39, ChronoUnit.DAYS));
        y6.setDeliverySealNumber("SEAL-5912"); y6.setDeliveredWeightTonnes(29.7); y6.setDeliveryMeterReading(119830.0);
        y6.setDeliverySamplePurityPct(94.4); y6.setDeliveredAt(now.minus(38, ChronoUnit.DAYS));
        y6.setFlags(ReconciliationRules.evaluate(new ReconciliationRules.Input(
                "SEAL-5912", "SEAL-5912", 30.0, 29.7, 94.5, 94.4, 119800.0, 119830.0, 2.0)));
        y6.setStatus(y6.getFlags().isEmpty() ? ShipmentStatus.DELIVERED : ShipmentStatus.FLAGGED);
        y6.setTransportCost(angToPdp * 30 * 4.0 + 5000);
        shipments.save(y6);
        audit.record(ALGAE, Role.UTILIZER, "SHIPMENT_DELIVERED", "Shipment", id(5022),
                AuditService.details("ownTransport", true, "deliveredWeightTonnes", 29.7, "flags", y6.getFlags()));

        // 7-8. In transit right now.
        Shipment y7 = shipment(id(5019), id(3020), SAHYADRI, TransportMode.TRUCK, boiToHos, 20,
                19.80, 72.75, 12.74, 77.83, now.minus(2, ChronoUnit.DAYS));
        y7.setSealNumber("SEAL-6488"); y7.setLoadedWeightTonnes(20.0); y7.setLoadMeterReading(30460.0);
        y7.setLoadSamplePurityPct(99.4); y7.setLoadedAt(now.minus(30, ChronoUnit.HOURS));
        y7.setStatus(ShipmentStatus.IN_TRANSIT);
        y7.setTransportCost(boiToHos * 20 * 4.0 + 5000);
        shipments.save(y7);
        transportOffer(id(5125), id(5019), SAHYADRI, TransportOfferStatus.ACCEPTED, GeoUtil.distanceKm(19.80, 72.75, 18.52, 73.86), y7.getTransportCost(), now.minus(2, ChronoUnit.DAYS));
        audit.record(TARAPUR, Role.EMITTER, "SHIPMENT_LOADED", "Shipment", id(5019), AuditService.details("seal", "SEAL-6488", "loadedWeightTonnes", 20.0));

        Shipment y8 = shipment(id(5024), id(3018), SAHYADRI, TransportMode.RAIL, rklToCbe, 45,
                22.26, 84.85, 11.02, 76.96, now.minus(3, ChronoUnit.DAYS));
        y8.setSealNumber("SEAL-6512"); y8.setLoadedWeightTonnes(45.0); y8.setLoadMeterReading(50210.0);
        y8.setLoadSamplePurityPct(93.8); y8.setLoadedAt(now.minus(2, ChronoUnit.DAYS));
        y8.setStatus(ShipmentStatus.IN_TRANSIT);
        y8.setTransportCost(rklToCbe * 45 * 2.5 + 15000);
        shipments.save(y8);
        transportOffer(id(5133), id(5024), SAHYADRI, TransportOfferStatus.ACCEPTED, puneHop, y8.getTransportCost(), now.minus(3, ChronoUnit.DAYS));

        // 9-10. Accepted but not yet loaded.
        Shipment y9 = shipment(id(5020), id(3018), SAHYADRI, TransportMode.RAIL, rklToCbe, 45,
                22.26, 84.85, 11.02, 76.96, now.minus(14, ChronoUnit.HOURS));
        y9.setStatus(ShipmentStatus.ACCEPTED);
        y9.setTransportCost(rklToCbe * 45 * 2.5 + 15000);
        shipments.save(y9);
        transportOffer(id(5126), id(5020), SAHYADRI, TransportOfferStatus.ACCEPTED, puneHop, y9.getTransportCost(), now.minus(14, ChronoUnit.HOURS));
        transportOffer(id(5127), id(5020), DECTRANS, TransportOfferStatus.EXPIRED, hydHop, null, now.minus(20, ChronoUnit.HOURS));
        notifications.notify(SUNDARGARH, "TRANSPORT_ACCEPTED", "A carrier accepted your shipment",
                "Sahyadri Cryo Carriers accepted the Rourkela → Coimbatore run and will collect tomorrow.", "Shipment", id(5020));

        Shipment y10 = shipment(id(5023), A_L4_ALGAE, ODTRANS, TransportMode.TRUCK, angToPdp, 35,
                20.84, 85.10, 20.32, 86.61, now.minus(8, ChronoUnit.HOURS));
        y10.setStatus(ShipmentStatus.ACCEPTED);
        y10.setTransportCost(angToPdp * 35 * 4.0 + 5000);
        shipments.save(y10);
        transportOffer(id(5131), id(5023), ODTRANS, TransportOfferStatus.ACCEPTED, GeoUtil.distanceKm(20.84, 85.10, 20.46, 85.88), y10.getTransportCost(), now.minus(8, ChronoUnit.HOURS));
        transportOffer(id(5132), id(5023), GUJTRANS, TransportOfferStatus.EXPIRED, GeoUtil.distanceKm(20.84, 85.10, 22.47, 70.06), null, now.minus(9, ChronoUnit.HOURS));
        notifications.notify(STEEL, "TRANSPORT_ACCEPTED", "A carrier accepted your shipment",
                "East Coast Gas Carriers accepted the Angul → Paradip run for 35 t.", "Shipment", id(5023));

        // 11-12. Advertised and still unclaimed, so each carrier portal has something to act on.
        Shipment y11 = shipment(id(5021), id(3021), null, TransportMode.RAIL, krbToMtr, 50,
                22.35, 82.68, 27.49, 77.67, now.minus(4, ChronoUnit.HOURS));
        y11.setStatus(ShipmentStatus.REQUESTED);
        y11.setTransportCost(krbToMtr * 50 * 2.5 + 15000);
        shipments.save(y11);
        transportOffer(id(5128), id(5021), DECTRANS, TransportOfferStatus.NOTIFIED, hydHop, null, now.minus(4, ChronoUnit.HOURS));
        transportOffer(id(5129), id(5021), SAHYADRI, TransportOfferStatus.NOTIFIED, GeoUtil.distanceKm(22.35, 82.68, 18.52, 73.86), null, now.minus(4, ChronoUnit.HOURS));
        transportOffer(id(5130), id(5021), ODTRANS, TransportOfferStatus.REJECTED, GeoUtil.distanceKm(22.35, 82.68, 20.46, 85.88), null, now.minus(3, ChronoUnit.HOURS));
        notifications.notify(DECTRANS, "TRANSPORT_REQUEST", "Shipment request near you",
                String.format("50 t of LIQUEFIED CO2 by RAIL, Korba → Mathura (%.0f km). Estimated ₹%.0f. Accept or reject.", krbToMtr, y11.getTransportCost()), "Shipment", id(5021));
        notifications.notify(SAHYADRI, "TRANSPORT_REQUEST", "Shipment request near you",
                String.format("50 t of LIQUEFIED CO2 by RAIL, Korba → Mathura (%.0f km). Estimated ₹%.0f. Accept or reject.", krbToMtr, y11.getTransportCost()), "Shipment", id(5021));
        audit.record(KORBA, Role.EMITTER, "SHIPMENT_REQUESTED", "Shipment", id(5021),
                AuditService.details("agreement", id(3021), "volumeTonnes", 50, "mode", "RAIL", "providersNotified", 3));

        Shipment y12 = shipment(id(5026), id(3020), null, TransportMode.TRUCK, boiToHos, 20,
                19.80, 72.75, 12.74, 77.83, now.minus(2, ChronoUnit.HOURS));
        y12.setStatus(ShipmentStatus.REQUESTED);
        y12.setTransportCost(boiToHos * 20 * 4.0 + 5000);
        shipments.save(y12);
        transportOffer(id(5136), id(5026), SAHYADRI, TransportOfferStatus.NOTIFIED, GeoUtil.distanceKm(19.80, 72.75, 18.52, 73.86), null, now.minus(2, ChronoUnit.HOURS));
        transportOffer(id(5137), id(5026), GUJTRANS, TransportOfferStatus.NOTIFIED, GeoUtil.distanceKm(19.80, 72.75, 22.47, 70.06), null, now.minus(2, ChronoUnit.HOURS));
        transportOffer(id(5138), id(5026), DECTRANS, TransportOfferStatus.EXPIRED, GeoUtil.distanceKm(19.80, 72.75, 17.38, 78.49), null, now.minus(2, ChronoUnit.HOURS));
        notifications.notify(SAHYADRI, "TRANSPORT_REQUEST", "Shipment request near you",
                String.format("20 t of LIQUEFIED CO2 by TRUCK, Boisar → Hosur (%.0f km). Estimated ₹%.0f. Accept or reject.", boiToHos, y12.getTransportCost()), "Shipment", id(5026));
        notifications.notify(GUJTRANS, "TRANSPORT_REQUEST", "Shipment request near you",
                String.format("20 t of LIQUEFIED CO2 by TRUCK, Boisar → Hosur (%.0f km). Estimated ₹%.0f. Accept or reject.", boiToHos, y12.getTransportCost()), "Shipment", id(5026));
        audit.record(TARAPUR, Role.EMITTER, "SHIPMENT_REQUESTED", "Shipment", id(5026),
                AuditService.details("agreement", id(3020), "volumeTonnes", 20, "mode", "TRUCK", "providersNotified", 3));

        // 13-15. Porbandar lane. Without these the cement emitter - the headline demo account -
        // signs in to an empty shipments page, because both of its deals are already finished.
        double pbrToDahej = GeoUtil.distanceKm(21.64, 69.61, 21.70, 72.57);
        double pbrToRajkot = GeoUtil.distanceKm(21.64, 69.61, 22.30, 70.80);
        double jamHop = GeoUtil.distanceKm(21.64, 69.61, 22.47, 70.06);

        Shipment y13 = shipment(id(5027), A_COMPLETED, GUJTRANS, TransportMode.TRUCK, pbrToDahej, 70,
                21.64, 69.61, 21.70, 72.57, now.minus(130, ChronoUnit.DAYS));
        y13.setSealNumber("SEAL-4410"); y13.setLoadedWeightTonnes(70.0); y13.setLoadMeterReading(70200.0);
        y13.setLoadSamplePurityPct(96.8); y13.setLoadedAt(now.minus(129, ChronoUnit.DAYS));
        y13.setDeliverySealNumber("SEAL-4410"); y13.setDeliveredWeightTonnes(69.3); y13.setDeliveryMeterReading(70270.0);
        y13.setDeliverySamplePurityPct(96.7); y13.setDeliveredAt(now.minus(128, ChronoUnit.DAYS));
        y13.setFlags(ReconciliationRules.evaluate(new ReconciliationRules.Input(
                "SEAL-4410", "SEAL-4410", 70.0, 69.3, 96.8, 96.7, 70200.0, 70270.0, 2.0)));
        y13.setStatus(y13.getFlags().isEmpty() ? ShipmentStatus.DELIVERED : ShipmentStatus.FLAGGED);
        y13.setTransportCost(pbrToDahej * 70 * 4.0 + 5000);
        shipments.save(y13);
        transportOffer(id(5141), id(5027), GUJTRANS, TransportOfferStatus.ACCEPTED, jamHop, y13.getTransportCost(), now.minus(130, ChronoUnit.DAYS));
        audit.record(METHANOL, Role.UTILIZER, "SHIPMENT_DELIVERED", "Shipment", id(5027),
                AuditService.details("deliverySeal", "SEAL-4410", "deliveredWeightTonnes", 69.3, "flags", y13.getFlags()));

        Shipment y14 = shipment(id(5028), A_COMPLETED, GUJTRANS, TransportMode.TRUCK, pbrToDahej, 65,
                21.64, 69.61, 21.70, 72.57, now.minus(100, ChronoUnit.DAYS));
        y14.setSealNumber("SEAL-4477"); y14.setLoadedWeightTonnes(65.0); y14.setLoadMeterReading(70900.0);
        y14.setLoadSamplePurityPct(96.8); y14.setLoadedAt(now.minus(99, ChronoUnit.DAYS));
        y14.setDeliverySealNumber("SEAL-4477"); y14.setDeliveredWeightTonnes(64.4); y14.setDeliveryMeterReading(70965.0);
        y14.setDeliverySamplePurityPct(96.8); y14.setDeliveredAt(now.minus(98, ChronoUnit.DAYS));
        y14.setFlags(ReconciliationRules.evaluate(new ReconciliationRules.Input(
                "SEAL-4477", "SEAL-4477", 65.0, 64.4, 96.8, 96.8, 70900.0, 70965.0, 2.0)));
        y14.setStatus(y14.getFlags().isEmpty() ? ShipmentStatus.DELIVERED : ShipmentStatus.FLAGGED);
        y14.setTransportCost(pbrToDahej * 65 * 4.0 + 5000);
        shipments.save(y14);
        transportOffer(id(5142), id(5028), GUJTRANS, TransportOfferStatus.ACCEPTED, jamHop, y14.getTransportCost(), now.minus(100, ChronoUnit.DAYS));

        // A second seal mismatch, on a different lane and a different carrier, so the rule is not
        // pinned to one company.
        Shipment y15 = shipment(id(5029), A_HIST_CEMENT_2, ODTRANS, TransportMode.TRUCK, pbrToRajkot, 50,
                21.64, 69.61, 22.30, 70.80, now.minus(170, ChronoUnit.DAYS));
        y15.setSealNumber("SEAL-4188"); y15.setLoadedWeightTonnes(50.0); y15.setLoadMeterReading(66400.0);
        y15.setLoadSamplePurityPct(96.8); y15.setLoadedAt(now.minus(169, ChronoUnit.DAYS));
        y15.setDeliverySealNumber("SEAL-4189"); y15.setDeliveredWeightTonnes(49.6); y15.setDeliveryMeterReading(66450.0);
        y15.setDeliverySamplePurityPct(96.7); y15.setDeliveredAt(now.minus(168, ChronoUnit.DAYS));
        y15.setFlags(ReconciliationRules.evaluate(new ReconciliationRules.Input(
                "SEAL-4188", "SEAL-4189", 50.0, 49.6, 96.8, 96.7, 66400.0, 66450.0, 2.0)));
        y15.setStatus(y15.getFlags().isEmpty() ? ShipmentStatus.DELIVERED : ShipmentStatus.FLAGGED);
        y15.setTransportCost(pbrToRajkot * 50 * 4.0 + 5000);
        shipments.save(y15);
        transportOffer(id(5143), id(5029), ODTRANS, TransportOfferStatus.ACCEPTED, GeoUtil.distanceKm(21.64, 69.61, 20.46, 85.88), y15.getTransportCost(), now.minus(170, ChronoUnit.DAYS));
        audit.record(CONCRETE, Role.UTILIZER, "SHIPMENT_FLAGGED", "Shipment", id(5029),
                AuditService.details("loadSeal", "SEAL-4188", "deliverySeal", "SEAL-4189", "flags", y15.getFlags()));
        notifications.notify(CEMENT, "SHIPMENT_FLAGGED", "Shipment flagged on delivery",
                "SEAL-4188 left Porbandar but SEAL-4189 arrived at Rajkot. The weight was within tolerance, so this is a paperwork failure rather than a loss.", "Shipment", id(5029));

        // Two offers that timed out on jobs the original seed already advertised.
        transportOffer(id(5139), id(5013), GUJTRANS, TransportOfferStatus.EXPIRED, GeoUtil.distanceKm(24.57, 80.83, 22.47, 70.06), null, now.minus(3, ChronoUnit.HOURS));
        transportOffer(id(5140), id(5005), ODTRANS, TransportOfferStatus.EXPIRED, GeoUtil.distanceKm(22.84, 69.72, 20.46, 85.88), null, now.minus(6, ChronoUnit.HOURS));
    }

    // =====================================================================================
    // Negotiation threads
    // -------------------------------------------------------------------------------------
    // The original seed had a single signed contract, so both negotiation pages looked empty.
    // Ten threads now cover every state: mid-thread OPEN ones waiting on each side in turn,
    // signed contracts, a rejected offer and withdrawn talks. Only the ACCEPTED ones lock
    // volume on a passport; the rest are conversations and hold nothing.
    // =====================================================================================
    private void seedNegotiationThreads(Instant now, LocalDate today) {
        Co2Passport p350 = passports.findById(P350).orElseThrow();
        Co2Passport p352 = passports.findById(P352).orElseThrow();

        // 1. OPEN, three offers deep, the emitter has to answer.
        Negotiation n1 = negotiation(NEG_CEM_CONC, P342, CEMENT, CONCRETE, CONCRETE, NegotiationStatus.OPEN, null, now.minus(9, ChronoUnit.DAYS));
        offer(id(4103), n1, 1, CONCRETE, 3900, 25, 12, PricingStructure.FIXED, false, 10.0, 10.0,
                "We mineralise CO2 into precast blocks at Rajkot. 25 t a month for a year, fixed price.", OfferStatus.COUNTERED, now.minus(9, ChronoUnit.DAYS));
        offer(id(4104), n1, 2, CEMENT, 4150, 25, 12, PricingStructure.FIXED, true, 10.0, 10.0,
                "₹4150/t is where liquefaction plus road haulage lands for us. Take-or-pay at 10% deposit.", OfferStatus.COUNTERED, now.minus(6, ChronoUnit.DAYS));
        offer(id(4105), n1, 3, CONCRETE, 4000, 25, 12, PricingStructure.FIXED, true, 10.0, 10.0,
                "Meeting you near the middle at ₹4000/t and accepting take-or-pay. This is our last number.", OfferStatus.PENDING, now.minus(2, ChronoUnit.DAYS));
        notifications.notify(CEMENT, "NEGOTIATION_COUNTER", "Counter-offer v3 received",
                "Carbonated Concrete Co countered: 25 t/month × 12 months at ₹4000/t, take-or-pay accepted.", "Negotiation", NEG_CEM_CONC);
        audit.record(CONCRETE, Role.UTILIZER, "OFFER_COUNTERED", "Negotiation", NEG_CEM_CONC,
                AuditService.details("version", 3, "pricePerTonne", 4000, "volumePerMonth", 25, "durationMonths", 12));

        // 2. OPEN, the utilizer has to answer.
        Negotiation n2 = negotiation(NEG_STL_ALGAE, P343, STEEL, ALGAE, ALGAE, NegotiationStatus.OPEN, null, now.minus(5, ChronoUnit.DAYS));
        offer(id(4106), n2, 1, ALGAE, 3300, 45, 18, PricingStructure.FIXED, true, 12.0, 10.0,
                "Our Paradip ponds can take 45 t a month for 18 months if the price holds at ₹3300/t.", OfferStatus.COUNTERED, now.minus(5, ChronoUnit.DAYS));
        offer(id(4107), n2, 2, STEEL, 3550, 45, 18, PricingStructure.INDEXED, true, 12.0, 15.0,
                "₹3550/t indexed to the fuel surcharge, 15% deposit. Volume and duration as you asked.", OfferStatus.PENDING, now.minus(28, ChronoUnit.HOURS));
        notifications.notify(ALGAE, "NEGOTIATION_COUNTER", "Counter-offer v2 received",
                "Kalinga Steel Plant countered: 45 t/month × 18 months at ₹3550/t, indexed pricing.", "Negotiation", NEG_STL_ALGAE);

        // 3. OPEN, opening offer still unanswered.
        Negotiation n3 = negotiation(NEG_PWR_GH, P344, POWER, GREENHOUSE, GREENHOUSE, NegotiationStatus.OPEN, null, now.minus(31, ChronoUnit.HOURS));
        offer(id(4108), n3, 1, GREENHOUSE, 3750, 12, 9, PricingStructure.FIXED, false, 10.0, 5.0,
                "Small but steady: 12 t a month for the tomato houses through the cool season.", OfferStatus.PENDING, now.minus(31, ChronoUnit.HOURS));
        notifications.notify(POWER, "NEGOTIATION_COUNTER", "Opening offer received",
                "Sabarmati Agro Greenhouses proposes 12 t/month × 9 months at ₹3750/t.", "Negotiation", NEG_PWR_GH);

        // 4. REJECTED: the offer was too far below the emitter's floor.
        Negotiation n4 = negotiation(NEG_CEM_METH, P342, CEMENT, METHANOL, METHANOL, NegotiationStatus.REJECTED, null, now.minus(22, ChronoUnit.DAYS));
        offer(id(4109), n4, 1, METHANOL, 3200, 60, 24, PricingStructure.FIXED, true, 10.0, 10.0,
                "Long tenor, big volume: 60 t a month for two years at ₹3200/t.", OfferStatus.REJECTED, now.minus(22, ChronoUnit.DAYS));
        notifications.notify(METHANOL, "NEGOTIATION_REJECTED", "Contract offer rejected",
                "Saurashtra Cement Works rejected offer v1. ₹3200/t sits below their liquefaction cost. The negotiation is closed.", "Negotiation", NEG_CEM_METH);
        audit.record(CEMENT, Role.EMITTER, "NEGOTIATION_REJECTED", "Negotiation", NEG_CEM_METH, AuditService.details("offerVersion", 1));

        // 5. CANCELLED: talks were withdrawn after two rounds.
        Negotiation n5 = negotiation(NEG_STL_CONC, P343, STEEL, CONCRETE, CONCRETE, NegotiationStatus.CANCELLED, null, now.minus(34, ChronoUnit.DAYS));
        offer(id(4110), n5, 1, CONCRETE, 3400, 30, 12, PricingStructure.FIXED, false, 10.0, 10.0,
                "Opening at ₹3400/t for 30 t a month.", OfferStatus.COUNTERED, now.minus(34, ChronoUnit.DAYS));
        offer(id(4111), n5, 2, STEEL, 3600, 30, 12, PricingStructure.FIXED, false, 10.0, 10.0,
                "₹3600/t, everything else as proposed.", OfferStatus.REJECTED, now.minus(31, ChronoUnit.DAYS));
        audit.record(CONCRETE, Role.UTILIZER, "NEGOTIATION_CANCELLED", "Negotiation", NEG_STL_CONC,
                AuditService.details("reason", "buyer secured the volume on a tender instead"));

        // 6. ACCEPTED: signed after two counters, and the contract exists.
        Negotiation n6 = negotiation(NEG_TAR_BEV, P350, TARAPUR, BEVGAS, BEVGAS, NegotiationStatus.ACCEPTED, id(3020), now.minus(27, ChronoUnit.DAYS));
        offer(id(4112), n6, 1, BEVGAS, 4400, 20, 12, PricingStructure.FIXED, true, 8.0, 10.0,
                "Beverage grade, 20 t a month. We will fund the polishing skid ourselves.", OfferStatus.COUNTERED, now.minus(27, ChronoUnit.DAYS));
        offer(id(4113), n6, 2, TARAPUR, 4600, 20, 12, PricingStructure.FIXED, true, 8.0, 10.0,
                "₹4600/t given the purity guarantee and the weekly ISO tank slots.", OfferStatus.COUNTERED, now.minus(24, ChronoUnit.DAYS));
        offer(id(4114), n6, 3, BEVGAS, 4550, 20, 12, PricingStructure.FIXED, true, 8.0, 10.0,
                "₹4550/t and we sign today.", OfferStatus.ACCEPTED, now.minus(22, ChronoUnit.DAYS));
        agreement(id(3020), null, null, n6, TARAPUR, BEVGAS, p350, SaleMode.CONTRACT, 240, 4550, AgreementStatus.ACTIVE,
                today.minusMonths(1).withDayOfMonth(1), today.minusMonths(1).withDayOfMonth(1).plusMonths(12), 12, 20.0, 10.0, true, 8.0, PricingStructure.FIXED, now.minus(22, ChronoUnit.DAYS));
        audit.record(TARAPUR, Role.EMITTER, "CONTRACT_SIGNED", "Agreement", id(3020),
                AuditService.details("negotiation", NEG_TAR_BEV, "lockedTonnes", 240, "pricePerTonne", 4550));
        notifications.notify(TARAPUR, "CONTRACT_SIGNED", "Contract accepted",
                "Palar Valley Beverage Gases accepted offer v3: 20 t/month × 12 months at ₹4550/t. 240 t locked on CO2-IND-2026-000350. Deposit 10% due at signing.", "Agreement", id(3020));

        // 7. ACCEPTED: the emitter's counter was taken as-is.
        Negotiation n7 = negotiation(NEG_KOR_SYN, P352, KORBA, SYNFUEL, SYNFUEL, NegotiationStatus.ACCEPTED, id(3021), now.minus(44, ChronoUnit.DAYS));
        offer(id(4115), n7, 1, SYNFUEL, 3600, 50, 12, PricingStructure.FIXED, true, 10.0, 10.0,
                "50 t a month feeds our methanol-to-gasoline pilot for a full year.", OfferStatus.COUNTERED, now.minus(44, ChronoUnit.DAYS));
        offer(id(4116), n7, 2, KORBA, 3700, 50, 12, PricingStructure.FIXED, true, 10.0, 10.0,
                "₹3700/t. Rail slots are reserved on the Korba to Mathura corridor.", OfferStatus.ACCEPTED, now.minus(41, ChronoUnit.DAYS));
        agreement(id(3021), null, null, n7, KORBA, SYNFUEL, p352, SaleMode.CONTRACT, 600, 3700, AgreementStatus.ACTIVE,
                today.minusMonths(1).withDayOfMonth(1), today.minusMonths(1).withDayOfMonth(1).plusMonths(12), 12, 50.0, 10.0, true, 10.0, PricingStructure.FIXED, now.minus(41, ChronoUnit.DAYS));
        audit.record(SYNFUEL, Role.UTILIZER, "CONTRACT_SIGNED", "Agreement", id(3021),
                AuditService.details("negotiation", NEG_KOR_SYN, "lockedTonnes", 600, "pricePerTonne", 3700));
        notifications.notify(KORBA, "CONTRACT_SIGNED", "Contract accepted",
                "Yamuna Synfuels accepted offer v2: 50 t/month × 12 months at ₹3700/t. 600 t locked on CO2-IND-2026-000352.", "Agreement", id(3021));

        // 8. REJECTED, second example: the buyer walked after one counter.
        Negotiation n8 = negotiation(NEG_VIN_MAL, P346, VINDHYA, MALWA, MALWA, NegotiationStatus.REJECTED, null, now.minus(17, ChronoUnit.DAYS));
        offer(id(4117), n8, 1, MALWA, 3950, 15, 6, PricingStructure.FIXED, false, 10.0, 5.0,
                "15 t a month for the Indore poly-houses over the winter crop.", OfferStatus.COUNTERED, now.minus(17, ChronoUnit.DAYS));
        offer(id(4118), n8, 2, VINDHYA, 4250, 15, 6, PricingStructure.FIXED, false, 10.0, 10.0,
                "₹4250/t with a 10% deposit; below that the tender route pays us more.", OfferStatus.REJECTED, now.minus(15, ChronoUnit.DAYS));
        notifications.notify(VINDHYA, "NEGOTIATION_REJECTED", "Contract offer rejected",
                "Malwa Protected Cultivation rejected offer v2 and will buy on the open tender instead.", "Negotiation", NEG_VIN_MAL);

        // 9. CANCELLED, second example: withdrawn before anyone countered.
        Negotiation n9 = negotiation(NEG_DEC_SPI, P347, DECCANREF, SPIRULINA, SPIRULINA, NegotiationStatus.CANCELLED, null, now.minus(12, ChronoUnit.DAYS));
        offer(id(4119), n9, 1, SPIRULINA, 3850, 35, 12, PricingStructure.INDEXED, true, 10.0, 10.0,
                "Indexed pricing suits us; 35 t a month to the Coimbatore raceways.", OfferStatus.REJECTED, now.minus(12, ChronoUnit.DAYS));
        audit.record(SPIRULINA, Role.UTILIZER, "NEGOTIATION_CANCELLED", "Negotiation", NEG_DEC_SPI,
                AuditService.details("reason", "buyer withdrew before the emitter responded"));

        // The two signed contracts are the only threads that moved volume, and both are counted
        // in the allocation figures set alongside their passports.
        trust.onAgreementCreated(TARAPUR, BEVGAS, KORBA, SYNFUEL);
        trust.refreshBadge(TARAPUR, KORBA);
        notifications.notify(REGULATOR, "COMPLIANCE_ALERT", "Two long-term contracts signed this quarter",
                "240 t on CO2-IND-2026-000350 and 600 t on CO2-IND-2026-000352, both take-or-pay. The offer threads behind them are in the audit trail.", "Company", REGULATOR);
    }

    /** One seeded negotiation thread. Offers are attached separately with {@link #offer}. */
    private Negotiation negotiation(UUID id, UUID passportId, UUID emitter, UUID utilizer, UUID initiatedBy,
                                    NegotiationStatus status, UUID agreementId, Instant created) {
        Negotiation n = new Negotiation();
        n.setId(id); n.setPassportId(passportId); n.setEmitterId(emitter); n.setUtilizerId(utilizer);
        n.setInitiatedByCompanyId(initiatedBy); n.setStatus(status); n.setAgreementId(agreementId); n.setCreatedAt(created);
        return negotiations.save(n);
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
        int n = Integer.parseInt(id.toString().substring(33));
        UUID userId = id(n + 100); // company ...0001xx → user ...0002xx
        Company c = new Company();
        c.setId(id); c.setName(name); c.setRole(role); c.setStatus(status); c.setContactEmail(email);
        c.setContactPhone(String.format("+91-%05d-%05d", 97000 + n, (n * 6173) % 100000));
        c.setAddress(String.format("Plot %d, %s Industrial Estate", 10 + (n * 7) % 180, city));
        c.setCity(city); c.setState(state); c.setCountry("India"); c.setLatitude(lat); c.setLongitude(lng);
        c.setSector(sector);
        // CIN shape: U<industry><state><year>PLC<serial>, so the admin list reads like a real register.
        c.setRegistrationNumber(String.format("U%05d%s%dPLC%06d", 20000 + sector.ordinal() * 1000 + n,
                stateCode(state), 2008 + n % 15, 100000 + n * 313));
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
        // Sign-up dates fan out so the admin list is not 30 identical timestamps; the two
        // applications still waiting and the one that was turned down are all recent.
        Instant registered = switch (status) {
            case PENDING -> Instant.now().minus(2L + n % 5, ChronoUnit.DAYS);
            case REJECTED -> Instant.now().minus(11, ChronoUnit.DAYS);
            case APPROVED -> Instant.now().minus(420L - n * 2L, ChronoUnit.DAYS);
        };
        c.setCreatedAt(registered);
        if (status == CompanyStatus.APPROVED) c.setApprovedAt(registered.plus(6, ChronoUnit.DAYS));
        companies.save(c);
        auth.createUser(userId, id, email, PASSWORD, contact, role);
        audit.record(ADMIN, Role.ADMIN, status == CompanyStatus.APPROVED ? "COMPANY_APPROVED" : "COMPANY_REGISTERED", "Company", id, AuditService.details("name", name, "role", role.name()));
    }

    /** Registrar-of-Companies state code, used to build a plausible CIN. */
    private static String stateCode(String state) {
        return switch (state) {
            case "Gujarat" -> "GJ";
            case "Odisha" -> "OR";
            case "Madhya Pradesh" -> "MP";
            case "Andhra Pradesh" -> "AP";
            case "Maharashtra" -> "MH";
            case "Telangana" -> "TG";
            case "Karnataka" -> "KA";
            case "Uttar Pradesh" -> "UP";
            case "Tamil Nadu" -> "TN";
            case "Chhattisgarh" -> "CT";
            case "Rajasthan" -> "RJ";
            case "Delhi" -> "DL";
            default -> "IN";
        };
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
