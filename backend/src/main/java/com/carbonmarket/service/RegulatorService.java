package com.carbonmarket.service;

import com.carbonmarket.domain.*;
import com.carbonmarket.dto.CompanyDtos.CompanyDto;
import com.carbonmarket.dto.CompanyDtos.RegulatorCompanyRow;
import com.carbonmarket.dto.MiscDtos.ImpactDto;
import com.carbonmarket.dto.MiscDtos.RegionStat;
import com.carbonmarket.dto.MiscDtos.SectorStat;
import com.carbonmarket.repository.*;
import com.carbonmarket.scoring.IncentiveRules;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Read-only oversight: aggregates, compliance and incentive flags. Also backs the public impact counter. */
@Service
public class RegulatorService {
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("yyyy-MM").withZone(ZoneOffset.UTC);

    private final CompanyRepository companies;
    private final PassportRepository passports;
    private final ListingRepository listings;
    private final AgreementRepository agreements;
    private final ShipmentRepository shipments;
    private final VerificationRequestRepository verifications;
    private final TrustProfileRepository trustProfiles;
    private final TrustService trust;
    private final Lookup lookup;
    private final AgreementService agreementService;
    private final ShipmentService shipmentService;
    private final VerificationService verificationService;
    private final PassportService passportService;

    public RegulatorService(CompanyRepository companies, PassportRepository passports, ListingRepository listings,
                            AgreementRepository agreements, ShipmentRepository shipments, VerificationRequestRepository verifications,
                            TrustProfileRepository trustProfiles, TrustService trust, Lookup lookup, AgreementService agreementService,
                            ShipmentService shipmentService, VerificationService verificationService, PassportService passportService) {
        this.companies = companies;
        this.passports = passports;
        this.listings = listings;
        this.agreements = agreements;
        this.shipments = shipments;
        this.verifications = verifications;
        this.trustProfiles = trustProfiles;
        this.trust = trust;
        this.lookup = lookup;
        this.agreementService = agreementService;
        this.shipmentService = shipmentService;
        this.verificationService = verificationService;
        this.passportService = passportService;
    }

    @Transactional(readOnly = true)
    public ImpactDto impact() {
        List<Agreement> all = agreements.findAll();
        double diverted = utilizedTonnes(all);
        double underContract = all.stream().filter(a -> a.getStatus() == AgreementStatus.ACTIVE).mapToDouble(Agreement::getVolumeTonnes).sum();
        List<Co2Passport> verified = passports.findByVerificationStatus(VerificationStatus.VERIFIED);
        Map<String, Double> byRegion = new TreeMap<>();
        Map<String, Double> bySector = new TreeMap<>();
        Set<String> clusters = new HashSet<>();
        for (Co2Passport p : verified) {
            Company e = lookup.company(p.getEmitterId());
            String region = e.getState() == null ? "Unknown" : e.getState();
            clusters.add(region);
            byRegion.merge(region, p.getTotalVolumeTonnes(), Double::sum);
            bySector.merge(e.getSector() == null ? "OTHER" : e.getSector().name(), p.getTotalVolumeTonnes(), Double::sum);
        }
        return new ImpactDto(r1(diverted), r1(underContract), clusters.size(), verified.size(),
                listings.findByStatusOrderByCreatedAtDesc(ListingStatus.OPEN).size(),
                all.stream().filter(a -> a.getStatus() == AgreementStatus.COMPLETED).count(),
                byRegion.entrySet().stream().map(e -> new RegionStat(e.getKey(), r1(e.getValue()))).toList(),
                bySector.entrySet().stream().map(e -> new SectorStat(e.getKey(), r1(e.getValue()))).toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> overview() {
        List<Agreement> all = agreements.findAll();
        List<Co2Passport> verified = passports.findByVerificationStatus(VerificationStatus.VERIFIED);
        double captured = verified.stream().mapToDouble(Co2Passport::getTotalVolumeTonnes).sum();
        double listed = listings.findByStatusOrderByCreatedAtDesc(ListingStatus.OPEN).stream().mapToDouble(Listing::getVolumeTonnes).sum();
        double traded = all.stream().filter(a -> a.getStatus() == AgreementStatus.ACTIVE || a.getStatus() == AgreementStatus.COMPLETED)
                .mapToDouble(Agreement::getVolumeTonnes).sum();
        double utilized = utilizedTonnes(all);

        Map<String, double[]> region = new TreeMap<>();
        Map<String, double[]> sector = new TreeMap<>();
        for (Co2Passport p : verified) {
            Company e = lookup.company(p.getEmitterId());
            region.computeIfAbsent(nz(e.getState()), k -> new double[2])[0] += p.getTotalVolumeTonnes();
            sector.computeIfAbsent(e.getSector() == null ? "OTHER" : e.getSector().name(), k -> new double[2])[0] += p.getTotalVolumeTonnes();
        }
        Map<String, double[]> month = new TreeMap<>();
        for (Agreement a : all) {
            if (a.getStatus() != AgreementStatus.ACTIVE && a.getStatus() != AgreementStatus.COMPLETED) continue;
            Company e = lookup.company(a.getEmitterId());
            region.computeIfAbsent(nz(e.getState()), k -> new double[2])[1] += a.getVolumeTonnes();
            sector.computeIfAbsent(e.getSector() == null ? "OTHER" : e.getSector().name(), k -> new double[2])[1] += a.getVolumeTonnes();
            double[] m = month.computeIfAbsent(MONTH.format(a.getCreatedAt()), k -> new double[2]);
            m[0] += a.getVolumeTonnes();
            if (a.getStatus() == AgreementStatus.COMPLETED) m[1] += a.getVolumeTonnes();
        }
        for (Shipment s : shipments.findByStatus(ShipmentStatus.DELIVERED)) {
            if (s.getDeliveredAt() == null) continue;
            month.computeIfAbsent(MONTH.format(s.getDeliveredAt()), k -> new double[2])[1] += s.getDeliveredWeightTonnes() == null ? s.getVolumeTonnes() : s.getDeliveredWeightTonnes();
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totals", map("capturedTonnes", r1(captured), "listedTonnes", r1(listed), "tradedTonnes", r1(traded), "utilizedTonnes", r1(utilized)));
        out.put("byRegion", region.entrySet().stream().map(e -> map("region", e.getKey(), "captured", r1(e.getValue()[0]), "traded", r1(e.getValue()[1]))).toList());
        out.put("bySector", sector.entrySet().stream().map(e -> map("sector", e.getKey(), "captured", r1(e.getValue()[0]), "traded", r1(e.getValue()[1]))).toList());
        out.put("byMonth", month.entrySet().stream().map(e -> map("month", e.getKey(), "traded", r1(e.getValue()[0]), "utilized", r1(e.getValue()[1]))).toList());
        out.put("flaggedShipments", shipments.findByStatus(ShipmentStatus.FLAGGED).size());
        out.put("expiredCoas", passports.findAll().stream().filter(p -> p.getLabCertificateStatus() == LabCertificateStatus.EXPIRED).count());
        out.put("pendingVerifications", verifications.findByStatusInOrderByPriorityDescSubmittedAtAsc(List.of(VerificationRequestStatus.QUEUED, VerificationRequestStatus.IN_REVIEW)).size());
        out.put("companies", companies.findAll().size());
        out.put("incentiveSchemes", List.of(
                map("code", IncentiveRules.CCUS_VGF_2026, "name", "India CCUS viability-gap funding (₹20,000 cr, 2026-27)", "rule", "Sector in Power/Steel/Cement/Refinery/Chemicals AND ≥1 verified passport AND ≥1 active/completed agreement"),
                map("code", IncentiveRules.NITI_CLUSTER_PILOT, "name", "NITI Aayog CCUS cluster-hub pilot", "rule", "Company located in Gujarat or Odisha"),
                map("code", IncentiveRules.CBAM_EXPORT_READY, "name", "EU CBAM financial phase (from 1 Jan 2026)", "rule", "Party to a CONTRACT agreement of ≥6 months (documented long-term CO2 offtake)")));
        return out;
    }

    @Transactional(readOnly = true)
    public List<RegulatorCompanyRow> companies() {
        return companies.findAllByOrderByCreatedAtAsc().stream().filter(c -> c.getRole() != Role.ADMIN).map(c -> {
            Facts f = facts(c);
            TrustProfile t = trustProfiles.findById(c.getId()).orElse(null);
            return new RegulatorCompanyRow(c.getId(), c.getName(), c.getRole(), c.getSector(), c.getCity(), c.getState(), c.getStatus(),
                    t == null ? null : t.getTier(), t == null ? 0 : t.getHiddenScore(), IncentiveRules.compliance(f.facts()),
                    IncentiveRules.incentives(f.facts()), f.facts().verifiedPassports(), f.totalAgreements(), f.facts().flaggedShipments());
        }).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> companyDetail(UUID id) {
        Company c = lookup.company(id);
        Facts f = facts(c);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("company", CompanyDto.from(c, trustProfiles.findById(id).orElse(null)));
        out.put("trust", trust.dto(id));
        List<Co2Passport> ps = passports.findByEmitterIdOrderByCreatedAtDesc(id);
        out.put("passports", ps.stream().map(passportService::dto).toList());
        out.put("verificationRequests", ps.isEmpty() ? List.of() : verifications.findByPassportIdInOrderBySubmittedAtDesc(ps.stream().map(Co2Passport::getId).toList())
                .stream().map(verificationService::dto).toList());
        List<Agreement> as = agreements.findByEmitterIdOrUtilizerIdOrderByCreatedAtDesc(id, id);
        out.put("agreements", as.stream().map(agreementService::dto).toList());
        out.put("shipments", as.isEmpty() ? List.of() : shipments.findByAgreementIdInOrderByCreatedAtDesc(as.stream().map(Agreement::getId).toList())
                .stream().map(shipmentService::dto).toList());
        out.put("complianceFlags", IncentiveRules.compliance(f.facts()));
        out.put("incentiveFlags", IncentiveRules.incentives(f.facts()));
        return out;
    }

    private record Facts(IncentiveRules.CompanyFacts facts, int totalAgreements) {}

    private Facts facts(Company c) {
        List<Co2Passport> ps = passports.findByEmitterIdOrderByCreatedAtDesc(c.getId());
        int verified = (int) ps.stream().filter(p -> p.getVerificationStatus() == VerificationStatus.VERIFIED).count();
        int expired = (int) ps.stream().filter(p -> p.getLabCertificateStatus() == LabCertificateStatus.EXPIRED).count();
        int pending = (int) ps.stream().filter(p -> p.getVerificationStatus() == VerificationStatus.PENDING).count();
        List<Agreement> as = agreements.findByEmitterIdOrUtilizerIdOrderByCreatedAtDesc(c.getId(), c.getId());
        int activeOrCompleted = (int) as.stream().filter(a -> a.getStatus() == AgreementStatus.ACTIVE || a.getStatus() == AgreementStatus.COMPLETED).count();
        int longContracts = (int) as.stream().filter(a -> a.getMode() == SaleMode.CONTRACT && a.getDurationMonths() != null && a.getDurationMonths() >= 6
                && a.getStatus() != AgreementStatus.CANCELLED).count();
        int flagged = as.isEmpty() ? 0 : (int) shipments.findByAgreementIdInOrderByCreatedAtDesc(as.stream().map(Agreement::getId).toList())
                .stream().filter(s -> s.getStatus() == ShipmentStatus.FLAGGED).count();
        TrustProfile t = trustProfiles.findById(c.getId()).orElse(null);
        return new Facts(new IncentiveRules.CompanyFacts(c.getSector(), c.getState(), verified, activeOrCompleted, longContracts, expired, pending,
                t == null ? 0 : t.cancellationRate(), flagged), as.size());
    }

    private double utilizedTonnes(List<Agreement> all) {
        double completed = all.stream().filter(a -> a.getStatus() == AgreementStatus.COMPLETED).mapToDouble(Agreement::getVolumeTonnes).sum();
        Set<UUID> completedIds = new HashSet<>();
        all.stream().filter(a -> a.getStatus() == AgreementStatus.COMPLETED).forEach(a -> completedIds.add(a.getId()));
        double delivered = shipments.findByStatus(ShipmentStatus.DELIVERED).stream().filter(s -> !completedIds.contains(s.getAgreementId()))
                .mapToDouble(s -> s.getDeliveredWeightTonnes() == null ? s.getVolumeTonnes() : s.getDeliveredWeightTonnes()).sum();
        return completed + delivered;
    }

    private static String nz(String s) { return s == null ? "Unknown" : s; }
    private static double r1(double v) { return Math.round(v * 10.0) / 10.0; }
    private static Map<String, Object> map(Object... kv) { return AuditService.details(kv); }
}
