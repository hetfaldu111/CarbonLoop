package com.carbonmarket.scoring;

import com.carbonmarket.domain.Tier;

/**
 * hidden_score = clamp(completion_rate*100 - cancellations_before_expiry*15, 0, 100)
 * completion_rate = total == 0 ? 0.5 : completed/total
 */
public final class TrustScoring {
    private TrustScoring() {}

    public static double completionRate(int total, int completed) {
        return total == 0 ? Rates.NEW_COMPANY_COMPLETION_RATE : (double) completed / total;
    }

    public static double hiddenScore(int total, int completed, int cancellations) {
        double score = completionRate(total, completed) * 100 - cancellations * Rates.CANCELLATION_PENALTY;
        return Math.round(clamp(score) * 100.0) / 100.0;
    }

    /**
     * Emitter badge. Emitters are not buyers, so completion rate says little about them; what a
     * buyer wants to know is how much CO2 they have actually shifted. Banded on cumulative tonnes
     * across ACTIVE and COMPLETED agreements.
     */
    public static Tier tierForTonnesSold(double tonnesSold) {
        if (tonnesSold >= 5000) return Tier.DIAMOND;
        if (tonnesSold >= 2000) return Tier.GOLD;
        if (tonnesSold >= 500) return Tier.SILVER;
        return Tier.BRONZE;
    }

    public static Tier tierFor(double score) {
        if (score >= 90) return Tier.DIAMOND;
        if (score >= 70) return Tier.GOLD;
        if (score >= 40) return Tier.SILVER;
        return Tier.BRONZE;
    }

    static double clamp(double v) { return Math.max(0, Math.min(100, v)); }
}
