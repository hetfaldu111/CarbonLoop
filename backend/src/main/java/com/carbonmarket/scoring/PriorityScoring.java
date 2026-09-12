package com.carbonmarket.scoring;

import com.carbonmarket.domain.SaleMode;
import com.carbonmarket.domain.Tier;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Utilizer Priority Score: deterministic weighted sum of normalised components, minus a
 * cancellation penalty. Returns the full explainable breakdown.
 */
public final class PriorityScoring {
    private PriorityScoring() {}

    public record Input(SaleMode mode, Tier tier, double hiddenScore, int totalAgreements, int cancellations,
                        double offeredPrice, double basePrice, double requestedVolume, double listingVolume,
                        int durationMonths, boolean acceptsEscrow, double distanceKm) {}

    public record Component(String name, Object rawValue, double normalized, double weight, double contribution, String explanation) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", name); m.put("rawValue", rawValue); m.put("normalized", r2(normalized));
            m.put("weight", weight); m.put("contribution", r2(contribution)); m.put("explanation", explanation);
            return m;
        }
    }

    public record Result(SaleMode mode, double total, List<Component> components) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("mode", mode.name());
            m.put("total", r2(total));
            m.put("components", components.stream().map(Component::toMap).toList());
            return m;
        }
        /** Top positive contributors, for the recommendation text. */
        public List<Component> topPositive(int n) {
            return components.stream().filter(c -> c.contribution() > 0)
                    .sorted((a, b) -> Double.compare(b.contribution(), a.contribution())).limit(n).toList();
        }
    }

    public static Result score(Input in) {
        Map<String, Double> w = Rates.weightsFor(in.mode());
        double wCancel = Rates.cancellationWeightFor(in.mode());
        List<Component> cs = new ArrayList<>();

        double tier = Rates.tierScore(in.tier());
        cs.add(comp("trustTier", in.tier().name(), tier, w.get("trustTier"), cap(in.tier().name()) + " trust tier"));

        cs.add(comp("hiddenScore", r2(in.hiddenScore()), in.hiddenScore(), w.get("hiddenScore"),
                "Hidden reliability score " + r2(in.hiddenScore()) + "/100"));

        double priceN = in.basePrice() <= 0 ? 50 : clamp(50 + (in.offeredPrice() - in.basePrice()) / in.basePrice() * 100);
        double pctDiff = in.basePrice() <= 0 ? 0 : (in.offeredPrice() - in.basePrice()) / in.basePrice() * 100;
        cs.add(comp("price", r2(in.offeredPrice()), priceN, w.get("price"),
                String.format("Offered ₹%.0f/t is %+.1f%% vs base ₹%.0f/t", in.offeredPrice(), pctDiff, in.basePrice())));

        double vMin = Math.min(in.requestedVolume(), in.listingVolume());
        double vMax = Math.max(in.requestedVolume(), in.listingVolume());
        double volN = vMax <= 0 ? 0 : 100 * vMin / vMax;
        cs.add(comp("volumeFit", r2(in.requestedVolume()), volN, w.get("volumeFit"),
                String.format("Requested %.0f t vs %.0f t listed (%.0f%% fit)", in.requestedVolume(), in.listingVolume(), volN)));

        double durN = clamp(in.durationMonths() / 12.0 * 100);
        cs.add(comp("duration", in.durationMonths(), durN, w.get("duration"),
                in.durationMonths() + " month commitment"));

        double escN = in.acceptsEscrow() ? 100 : 0;
        cs.add(comp("escrow", in.acceptsEscrow(), escN, w.get("escrow"),
                in.acceptsEscrow() ? "Accepts escrow / deposit" : "Does not accept escrow"));

        double distN = clamp(100 - in.distanceKm() / 10.0);
        cs.add(comp("distance", r2(in.distanceKm()), distN, w.get("distance"),
                String.format("%.0f km from source", in.distanceKm())));

        double cancelRate = in.totalAgreements() == 0 ? 0 : (double) in.cancellations() / in.totalAgreements();
        double cancelN = cancelRate * 100;
        cs.add(new Component("cancellationRate", r2(cancelRate), cancelN, -wCancel, -(cancelN * wCancel),
                in.cancellations() + " of " + in.totalAgreements() + " agreements cancelled before expiry"));

        double total = clamp(cs.stream().mapToDouble(Component::contribution).sum());
        return new Result(in.mode(), r2(total), cs);
    }

    private static Component comp(String name, Object raw, double normalized, double weight, String explanation) {
        return new Component(name, raw, normalized, weight, normalized * weight, explanation);
    }

    static double clamp(double v) { return Math.max(0, Math.min(100, v)); }
    static double r2(double v) { return Math.round(v * 100.0) / 100.0; }
    private static String cap(String s) { return s.charAt(0) + s.substring(1).toLowerCase(); }
}
