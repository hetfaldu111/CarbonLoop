package com.carbonmarket.scoring;

import java.util.ArrayList;
import java.util.List;

/** Point-of-delivery reconciliation against point-of-loading records. */
public final class ReconciliationRules {
    private ReconciliationRules() {}

    public static final String SEAL_MISMATCH = "SEAL_MISMATCH";
    public static final String WEIGHT_GAP = "WEIGHT_GAP";
    public static final String PURITY_DRIFT = "PURITY_DRIFT";
    public static final String METER_MISMATCH = "METER_MISMATCH";

    public record Input(String loadSeal, String deliverySeal, Double loadedWeight, Double deliveredWeight,
                        Double loadPurity, Double deliveryPurity, Double loadMeter, Double deliveryMeter,
                        double leakageTolerancePct) {}

    public static List<String> evaluate(Input in) {
        List<String> flags = new ArrayList<>();
        if (in.loadSeal() != null && in.deliverySeal() != null && !in.loadSeal().trim().equalsIgnoreCase(in.deliverySeal().trim())) {
            flags.add(SEAL_MISMATCH);
        }
        if (in.loadedWeight() != null && in.deliveredWeight() != null && in.loadedWeight() > 0) {
            double gapPct = (in.loadedWeight() - in.deliveredWeight()) / in.loadedWeight() * 100.0;
            if (gapPct > in.leakageTolerancePct()) flags.add(WEIGHT_GAP);
        }
        if (in.loadPurity() != null && in.deliveryPurity() != null
                && Math.abs(in.loadPurity() - in.deliveryPurity()) > Rates.PURITY_DRIFT_TOLERANCE_PCT_POINTS) {
            flags.add(PURITY_DRIFT);
        }
        if (in.loadMeter() != null && in.deliveryMeter() != null && in.loadedWeight() != null && in.loadedWeight() > 0) {
            double metered = Math.abs(in.loadMeter() - in.deliveryMeter());
            double diffPct = Math.abs(metered - in.loadedWeight()) / in.loadedWeight() * 100.0;
            if (diffPct > Rates.METER_MISMATCH_TOLERANCE_PCT) flags.add(METER_MISMATCH);
        }
        return flags;
    }
}
