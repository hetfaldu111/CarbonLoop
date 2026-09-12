package com.carbonmarket.scoring;

import com.carbonmarket.common.BadRequestException;
import com.carbonmarket.domain.TransportMode;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Cost Stack: every layer computed and reported separately; carbon numbers kept apart from money. */
public final class CostCalculator {
    private CostCalculator() {}

    public record Input(double quantityTonnes, double basePricePerTonne, double passportConcentrationPct,
                        Map<String, Double> passportImpuritiesPpm, Double requiredPurityPct,
                        Map<String, Double> impurityLimitsPpm, TransportMode transportMode, double distanceKm,
                        boolean pipelineConnected, double platformFeePct) {}

    public record Layer(String name, double amount, double perTonne, String detail) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", name); m.put("amount", r2(amount)); m.put("perTonne", r2(perTonne)); m.put("detail", detail);
            return m;
        }
    }

    public record PurificationStep(String parameter, double passportLevel, double requiredLevel, double ratePerTonne, double cost) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("parameter", parameter); m.put("passportLevel", passportLevel); m.put("requiredLevel", requiredLevel);
            m.put("ratePerTonne", ratePerTonne); m.put("cost", r2(cost));
            return m;
        }
    }

    public record Carbon(double grossTonnes, double expectedLeakagePct, double leakageLossTonnes,
                         double effectiveDeliveredTonnes, double transportEmissionsTonnes, double netCarbonBenefitTonnes) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("grossTonnes", r2(grossTonnes)); m.put("expectedLeakagePct", r2(expectedLeakagePct));
            m.put("leakageLossTonnes", r3(leakageLossTonnes)); m.put("effectiveDeliveredTonnes", r3(effectiveDeliveredTonnes));
            m.put("transportEmissionsTonnes", r3(transportEmissionsTonnes)); m.put("netCarbonBenefitTonnes", r3(netCarbonBenefitTonnes));
            return m;
        }
    }

    public record Result(double quantityTonnes, double distanceKm, TransportMode transportMode, List<Layer> layers,
                         List<PurificationStep> purificationSteps, double totalDeliveredCost, double totalPerTonne, Carbon carbon) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("quantityTonnes", quantityTonnes); m.put("distanceKm", distanceKm); m.put("transportMode", transportMode.name());
            m.put("layers", layers.stream().map(Layer::toMap).toList());
            m.put("purificationSteps", purificationSteps.stream().map(PurificationStep::toMap).toList());
            m.put("totalDeliveredCost", r2(totalDeliveredCost)); m.put("totalPerTonne", r2(totalPerTonne));
            m.put("carbon", carbon.toMap());
            return m;
        }
        public Layer layer(String name) { return layers.stream().filter(l -> l.name().equals(name)).findFirst().orElseThrow(); }
    }

    public static final String BASE = "Base CO2 cost";
    public static final String PURIFICATION = "Purification / conditioning";
    public static final String TRANSPORT = "Transportation";
    public static final String VERIFICATION = "Verification / lab";
    public static final String PLATFORM = "Platform fee";

    public static Result calculate(Input in) {
        double qty = in.quantityTonnes();
        if (qty <= 0) throw new BadRequestException("quantityTonnes must be > 0");
        TransportMode mode = in.transportMode() == null ? TransportMode.TRUCK : in.transportMode();
        if (mode == TransportMode.PIPELINE && (!in.pipelineConnected() || in.distanceKm() > Rates.PIPELINE_MAX_DISTANCE_KM)) {
            throw new BadRequestException("PIPELINE_UNAVAILABLE: pipeline transport needs a pipeline-connected source within "
                    + (int) Rates.PIPELINE_MAX_DISTANCE_KM + " km (distance " + in.distanceKm() + " km)");
        }
        List<Layer> layers = new ArrayList<>();

        // 1. Base
        double base = in.basePricePerTonne() * qty;
        layers.add(new Layer(BASE, base, in.basePricePerTonne(),
                String.format("₹%.0f/t × %.1f t (emitter listing price)", in.basePricePerTonne(), qty)));

        // 2. Purification
        List<PurificationStep> steps = new ArrayList<>();
        if (in.requiredPurityPct() != null && in.requiredPurityPct() > in.passportConcentrationPct()) {
            double gap = in.requiredPurityPct() - in.passportConcentrationPct();
            double rate = gap * Rates.PURITY_UPGRADE_RATE_PER_PCT_POINT;
            steps.add(new PurificationStep("CO2 concentration", in.passportConcentrationPct(), in.requiredPurityPct(), r2(rate), rate * qty));
        }
        if (in.impurityLimitsPpm() != null) {
            for (Map.Entry<String, Double> e : in.impurityLimitsPpm().entrySet()) {
                if (e.getValue() == null) continue;
                Double rate = Rates.IMPURITY_REMOVAL_RATES.get(e.getKey());
                if (rate == null) continue;
                double level = in.passportImpuritiesPpm() == null ? 0 : in.passportImpuritiesPpm().getOrDefault(e.getKey(), 0.0);
                if (level > e.getValue()) steps.add(new PurificationStep(e.getKey(), level, e.getValue(), rate, rate * qty));
            }
        }
        double purification = steps.stream().mapToDouble(PurificationStep::cost).sum();
        layers.add(new Layer(PURIFICATION, purification, purification / qty,
                steps.isEmpty() ? "Raw stream already meets requested spec" : steps.size() + " conditioning step(s) required"));

        // 3. Transport
        double transport = in.distanceKm() * qty * Rates.transportRatePerTonneKm(mode) + Rates.transportFixedPerShipment(mode);
        layers.add(new Layer(TRANSPORT, transport, transport / qty,
                String.format("%s: %.1f km × %.1f t × ₹%.2f/t·km + ₹%.0f fixed", mode, in.distanceKm(), qty,
                        Rates.transportRatePerTonneKm(mode), Rates.transportFixedPerShipment(mode))));

        // 4. Verification
        double verification = Rates.VERIFICATION_FEE_PER_SHIPMENT;
        layers.add(new Layer(VERIFICATION, verification, verification / qty, "Flat independent lab fee per shipment (COA + seal check)"));

        // 5. Platform
        double subtotal = base + purification + transport + verification;
        double platform = subtotal * in.platformFeePct() / 100.0;
        layers.add(new Layer(PLATFORM, platform, platform / qty, String.format("%.1f%% of subtotal", in.platformFeePct())));

        double total = subtotal + platform;

        // Carbon (separate)
        double leakagePct = Rates.baseLeakagePct(mode) + 0.1 * (in.distanceKm() / 100.0);
        double leakageLoss = qty * leakagePct / 100.0;
        double effective = qty - leakageLoss;
        double transportEmissions = qty * in.distanceKm() * Rates.emissionFactor(mode) / 1000.0;
        double net = effective - transportEmissions;
        Carbon carbon = new Carbon(qty, leakagePct, leakageLoss, effective, transportEmissions, net);

        return new Result(qty, in.distanceKm(), mode, layers, steps, total, total / qty, carbon);
    }

    static double r2(double v) { return Math.round(v * 100.0) / 100.0; }
    static double r3(double v) { return Math.round(v * 1000.0) / 1000.0; }
}
