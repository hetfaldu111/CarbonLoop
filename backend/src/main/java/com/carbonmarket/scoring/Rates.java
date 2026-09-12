package com.carbonmarket.scoring;

import com.carbonmarket.domain.SaleMode;
import com.carbonmarket.domain.Tier;
import com.carbonmarket.domain.TransportMode;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * All constants used by the deterministic formulas, in one place so they can be
 * shown to users ("how is this calculated?") and defended in Q&A.
 */
public final class Rates {
    private Rates() {}

    // ---- Trust ----
    public static final double CANCELLATION_PENALTY = 15.0;
    public static final double NEW_COMPANY_COMPLETION_RATE = 0.5;

    // ---- Priority score weights (positive contributions) ----
    public static final Map<String, Double> TENDER_WEIGHTS = ordered(
            "trustTier", 0.20, "hiddenScore", 0.15, "price", 0.15, "volumeFit", 0.15,
            "duration", 0.10, "escrow", 0.10, "distance", 0.05);
    public static final Map<String, Double> AUCTION_WEIGHTS = ordered(
            "trustTier", 0.10, "hiddenScore", 0.10, "price", 0.45, "volumeFit", 0.10,
            "duration", 0.00, "escrow", 0.05, "distance", 0.05);
    public static final double TENDER_CANCELLATION_WEIGHT = 0.30;
    public static final double AUCTION_CANCELLATION_WEIGHT = 0.25;

    public static Map<String, Double> weightsFor(SaleMode mode) {
        return mode == SaleMode.AUCTION ? AUCTION_WEIGHTS : TENDER_WEIGHTS;
    }

    public static double cancellationWeightFor(SaleMode mode) {
        return mode == SaleMode.AUCTION ? AUCTION_CANCELLATION_WEIGHT : TENDER_CANCELLATION_WEIGHT;
    }

    public static double tierScore(Tier tier) {
        return switch (tier) {
            case BRONZE -> 25;
            case SILVER -> 50;
            case GOLD -> 75;
            case DIAMOND -> 100;
        };
    }

    // ---- Cost stack (INR) ----
    public static final double PURITY_UPGRADE_RATE_PER_PCT_POINT = 150.0; // ₹ per tonne per %-point
    public static final Map<String, Double> IMPURITY_REMOVAL_RATES = ordered(
            "H2O", 80.0, "O2", 60.0, "NOx", 100.0, "SOx", 120.0, "H2S", 140.0, "CO", 90.0, "N2", 70.0);
    public static final double VERIFICATION_FEE_PER_SHIPMENT = 12_000.0;
    public static final double PIPELINE_MAX_DISTANCE_KM = 100.0;

    public static double transportRatePerTonneKm(TransportMode mode) {
        return switch (mode) {
            case PIPELINE -> 0.8;
            case RAIL -> 2.5;
            case TRUCK -> 4.0;
        };
    }

    public static double transportFixedPerShipment(TransportMode mode) {
        return switch (mode) {
            case PIPELINE -> 0;
            case RAIL -> 15_000;
            case TRUCK -> 5_000;
        };
    }

    public static double baseLeakagePct(TransportMode mode) {
        return switch (mode) {
            case PIPELINE -> 0.5;
            case RAIL -> 1.5;
            case TRUCK -> 2.0;
        };
    }

    /** kg CO2 per tonne-km. */
    public static double emissionFactor(TransportMode mode) {
        return switch (mode) {
            case PIPELINE -> 0.005;
            case RAIL -> 0.022;
            case TRUCK -> 0.062;
        };
    }

    // ---- Reconciliation ----
    public static final double DEFAULT_LEAKAGE_TOLERANCE_PCT = 2.0;
    public static final double PURITY_DRIFT_TOLERANCE_PCT_POINTS = 0.5;
    public static final double METER_MISMATCH_TOLERANCE_PCT = 2.0;

    // ---- Transport marketplace ----
    public static final double TRANSPORT_NOTIFY_RADIUS_KM = 100.0;

    /** Everything above as a JSON-friendly map (GET /api/meta/rates). */
    public static Map<String, Object> asMap(double platformFeePct) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("currency", "INR");
        m.put("trust", ordered("cancellationPenalty", CANCELLATION_PENALTY, "newCompanyCompletionRate", NEW_COMPANY_COMPLETION_RATE,
                "formula", "hidden_score = clamp(completion_rate*100 - cancellations_before_expiry*15, 0, 100)",
                "tiers", ordered("BRONZE", "< 40", "SILVER", "40-69", "GOLD", "70-89", "DIAMOND", ">= 90")));
        m.put("priorityWeights", ordered("TENDER", TENDER_WEIGHTS, "AUCTION", AUCTION_WEIGHTS,
                "cancellationPenaltyWeight", ordered("TENDER", TENDER_CANCELLATION_WEIGHT, "AUCTION", AUCTION_CANCELLATION_WEIGHT),
                "tierScores", ordered("BRONZE", 25, "SILVER", 50, "GOLD", 75, "DIAMOND", 100),
                "normalisation", ordered(
                        "price", "clamp(50 + (offered - base)/base * 100, 0, 100)",
                        "volumeFit", "100 * min(req, listingVolume) / max(req, listingVolume)",
                        "duration", "clamp(months/12 * 100, 0, 100)",
                        "escrow", "100 if accepted else 0",
                        "distance", "clamp(100 - km/10, 0, 100)")));
        m.put("cost", ordered(
                "purityUpgradeRatePerPctPoint", PURITY_UPGRADE_RATE_PER_PCT_POINT,
                "impurityRemovalRatesPerTonne", IMPURITY_REMOVAL_RATES,
                "transportRatePerTonneKm", ordered("PIPELINE", 0.8, "RAIL", 2.5, "TRUCK", 4.0),
                "transportFixedPerShipment", ordered("PIPELINE", 0, "RAIL", 15000, "TRUCK", 5000),
                "pipelineMaxDistanceKm", PIPELINE_MAX_DISTANCE_KM,
                "verificationFeePerShipment", VERIFICATION_FEE_PER_SHIPMENT,
                "platformFeePct", platformFeePct));
        m.put("carbon", ordered(
                "baseLeakagePct", ordered("PIPELINE", 0.5, "RAIL", 1.5, "TRUCK", 2.0),
                "leakagePctPer100Km", 0.1,
                "emissionFactorKgPerTonneKm", ordered("PIPELINE", 0.005, "RAIL", 0.022, "TRUCK", 0.062)));
        m.put("reconciliation", ordered("defaultLeakageTolerancePct", DEFAULT_LEAKAGE_TOLERANCE_PCT,
                "purityDriftTolerance", PURITY_DRIFT_TOLERANCE_PCT_POINTS, "meterMismatchTolerancePct", METER_MISMATCH_TOLERANCE_PCT));
        m.put("transportNotifyRadiusKm", TRANSPORT_NOTIFY_RADIUS_KM);
        return m;
    }

    @SuppressWarnings("unchecked")
    static <V> Map<String, V> ordered(Object... kv) {
        Map<String, V> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], (V) kv[i + 1]);
        return m;
    }
}
