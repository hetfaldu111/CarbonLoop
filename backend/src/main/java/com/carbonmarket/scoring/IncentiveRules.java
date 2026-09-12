package com.carbonmarket.scoring;

import com.carbonmarket.domain.Sector;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Rule-based policy flags shown to the Policy Regulator. Grounded in real 2026 Indian/EU policy. */
public final class IncentiveRules {
    private IncentiveRules() {}

    public static final String CCUS_VGF_2026 = "CCUS_VGF_2026";          // India ₹20,000 cr CCUS viability-gap funding
    public static final String NITI_CLUSTER_PILOT = "NITI_CLUSTER_PILOT"; // NITI Aayog cluster-hub pilot regions
    public static final String CBAM_EXPORT_READY = "CBAM_EXPORT_READY";   // EU CBAM financial phase from 1 Jan 2026

    public static final String COA_EXPIRED = "COA_EXPIRED";
    public static final String HIGH_CANCELLATION = "HIGH_CANCELLATION";
    public static final String FLAGGED_SHIPMENTS = "FLAGGED_SHIPMENTS";
    public static final String PENDING_VERIFICATION = "PENDING_VERIFICATION";

    private static final Set<Sector> VGF_SECTORS = Set.of(Sector.POWER, Sector.STEEL, Sector.CEMENT, Sector.REFINERY, Sector.CHEMICALS);
    private static final Set<String> PILOT_STATES = Set.of("gujarat", "odisha");

    public record CompanyFacts(Sector sector, String state, int verifiedPassports, int activeOrCompletedAgreements,
                               int contractAgreementsAtLeast6Months, int expiredCoas, int pendingPassports,
                               double cancellationRate, int flaggedShipments) {}

    public static List<String> incentives(CompanyFacts f) {
        List<String> out = new ArrayList<>();
        if (f.sector() != null && VGF_SECTORS.contains(f.sector()) && f.verifiedPassports() >= 1 && f.activeOrCompletedAgreements() >= 1) {
            out.add(CCUS_VGF_2026);
        }
        if (f.state() != null && PILOT_STATES.contains(f.state().trim().toLowerCase())) out.add(NITI_CLUSTER_PILOT);
        if (f.contractAgreementsAtLeast6Months() >= 1) out.add(CBAM_EXPORT_READY);
        return out;
    }

    public static List<String> compliance(CompanyFacts f) {
        List<String> out = new ArrayList<>();
        if (f.expiredCoas() > 0) out.add(COA_EXPIRED);
        if (f.cancellationRate() > 0.2) out.add(HIGH_CANCELLATION);
        if (f.flaggedShipments() > 0) out.add(FLAGGED_SHIPMENTS);
        if (f.pendingPassports() > 0) out.add(PENDING_VERIFICATION);
        return out;
    }
}
