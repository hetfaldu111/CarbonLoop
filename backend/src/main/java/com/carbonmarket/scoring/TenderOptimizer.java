package com.carbonmarket.scoring;

import com.carbonmarket.domain.Tier;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Picks the combination of tender proposals that earns the emitter the most money without
 * exceeding the volume released.
 *
 * <p>This is an exact 0/1 knapsack solved by dynamic programming — plain arithmetic, no model
 * and no heuristic, so the emitter can be shown exactly why a combination won. Quantities are
 * scaled to tenths of a tonne so fractional volumes work with an integer DP.
 *
 * <p>When two combinations earn the identical amount, the tie is broken in this order:
 * higher summed trust tier, then higher summed hidden score, then smaller total volume (which
 * leaves more free stock), then earlier submissions.
 *
 * <p>If the DP table would exceed {@link #MAX_CELLS} cells the solver falls back to a greedy
 * pass by revenue per tonne and reports {@code exact = false}.
 */
public final class TenderOptimizer {
    private TenderOptimizer() {}

    /** Above this many DP cells we stop solving exactly and fall back to greedy. */
    public static final long MAX_CELLS = 20_000_000L;
    private static final int SCALE = 10; // tenths of a tonne

    /** One candidate proposal. {@code createdRank} is 0 for the earliest submission. */
    public record Item(UUID proposalId, double quantityTonnes, double pricePerTonne, Tier tier,
                       double hiddenScore, int createdRank) {
        public double revenue() { return quantityTonnes * pricePerTonne; }
    }

    /** The chosen combination. */
    public record Selection(List<UUID> proposalIds, double totalRevenue, double totalTonnes,
                            double leftoverTonnes, boolean exact) {}

    public static int tierRank(Tier t) {
        if (t == null) return 0;
        return switch (t) { case BRONZE -> 1; case SILVER -> 2; case GOLD -> 3; case DIAMOND -> 4; };
    }

    /** Best-revenue combination of {@code items} that fits within {@code capacityTonnes}. */
    public static Selection solve(List<Item> items, double capacityTonnes) {
        List<Item> candidates = new ArrayList<>();
        if (items != null) {
            for (Item i : items) {
                // A proposal larger than the released volume can never be part of any combination.
                if (i.quantityTonnes() > 0 && i.quantityTonnes() <= capacityTonnes + 1e-9) candidates.add(i);
            }
        }
        if (candidates.isEmpty()) return new Selection(List.of(), 0, 0, round(capacityTonnes), true);

        int cap = (int) Math.round(capacityTonnes * SCALE);
        int n = candidates.size();
        if (cap <= 0) return new Selection(List.of(), 0, 0, round(capacityTonnes), true);
        if ((long) cap * n > MAX_CELLS) return greedy(candidates, capacityTonnes);

        int[] w = new int[n];
        for (int i = 0; i < n; i++) w[i] = Math.max(1, (int) Math.round(candidates.get(i).quantityTonnes() * SCALE));

        // DP state per remaining-capacity cell, compared lexicographically by the tie-break chain.
        long[] revenue = new long[cap + 1];          // paise, so equal revenues compare exactly
        int[] tierSum = new int[cap + 1];
        long[] hiddenSum = new long[cap + 1];        // hidden score x100
        int[] tonnesUsed = new int[cap + 1];
        int[] rankSum = new int[cap + 1];
        boolean[][] take = new boolean[n][cap + 1];

        for (int i = 0; i < n; i++) {
            Item it = candidates.get(i);
            long rev = Math.round(it.revenue() * 100.0);
            int tr = tierRank(it.tier());
            long hs = Math.round(it.hiddenScore() * 100.0);
            for (int c = cap; c >= w[i]; c--) {
                int prev = c - w[i];
                long cRev = revenue[prev] + rev;
                int cTier = tierSum[prev] + tr;
                long cHidden = hiddenSum[prev] + hs;
                int cTonnes = tonnesUsed[prev] + w[i];
                int cRank = rankSum[prev] + it.createdRank();
                if (better(cRev, cTier, cHidden, cTonnes, cRank,
                        revenue[c], tierSum[c], hiddenSum[c], tonnesUsed[c], rankSum[c])) {
                    revenue[c] = cRev; tierSum[c] = cTier; hiddenSum[c] = cHidden;
                    tonnesUsed[c] = cTonnes; rankSum[c] = cRank;
                    take[i][c] = true;
                }
            }
        }

        // The best cell is not necessarily the last one: pick the winner across all capacities.
        int best = 0;
        for (int c = 1; c <= cap; c++) {
            if (better(revenue[c], tierSum[c], hiddenSum[c], tonnesUsed[c], rankSum[c],
                    revenue[best], tierSum[best], hiddenSum[best], tonnesUsed[best], rankSum[best])) {
                best = c;
            }
        }

        List<UUID> chosen = new ArrayList<>();
        double tonnes = 0, rev = 0;
        int c = best;
        for (int i = n - 1; i >= 0; i--) {
            if (c >= w[i] && take[i][c]) {
                Item it = candidates.get(i);
                chosen.add(it.proposalId());
                tonnes += it.quantityTonnes();
                rev += it.revenue();
                c -= w[i];
            }
        }
        java.util.Collections.reverse(chosen);
        return new Selection(List.copyOf(chosen), round(rev), round(tonnes), round(capacityTonnes - tonnes), true);
    }

    /** Lexicographic "is a strictly better than b" over the documented tie-break chain. */
    private static boolean better(long revA, int tierA, long hidA, int tonA, int rankA,
                                  long revB, int tierB, long hidB, int tonB, int rankB) {
        if (revA != revB) return revA > revB;
        if (tierA != tierB) return tierA > tierB;
        if (hidA != hidB) return hidA > hidB;
        if (tonA != tonB) return tonA < tonB;     // smaller volume leaves more free stock
        return rankA < rankB;                     // earlier submissions win
    }

    /** Fallback for very large inputs: take the best revenue per tonne while it still fits. */
    private static Selection greedy(List<Item> items, double capacityTonnes) {
        List<Item> sorted = new ArrayList<>(items);
        sorted.sort(Comparator.<Item>comparingDouble(i -> -i.pricePerTonne())
                .thenComparing(i -> -tierRank(i.tier()))
                .thenComparingInt(Item::createdRank));
        List<UUID> chosen = new ArrayList<>();
        double tonnes = 0, revenue = 0;
        for (Item i : sorted) {
            if (tonnes + i.quantityTonnes() <= capacityTonnes + 1e-9) {
                chosen.add(i.proposalId());
                tonnes += i.quantityTonnes();
                revenue += i.revenue();
            }
        }
        return new Selection(List.copyOf(chosen), round(revenue), round(tonnes), round(capacityTonnes - tonnes), false);
    }

    /** Highest-revenue single proposal that fits — the baseline the recommendation is compared against. */
    public static Selection bestSingle(List<Item> items, double capacityTonnes) {
        Item best = null;
        for (Item i : items == null ? List.<Item>of() : items) {
            if (i.quantityTonnes() > capacityTonnes + 1e-9) continue;
            if (best == null || i.revenue() > best.revenue()
                    || (i.revenue() == best.revenue() && tierRank(i.tier()) > tierRank(best.tier()))) {
                best = i;
            }
        }
        if (best == null) return new Selection(List.of(), 0, 0, round(capacityTonnes), true);
        return new Selection(List.of(best.proposalId()), round(best.revenue()), round(best.quantityTonnes()),
                round(capacityTonnes - best.quantityTonnes()), true);
    }

    /** Highest trust-weighted proposals packed greedily — shown as an alternative to pure revenue. */
    public static Selection bestTrustWeighted(List<Item> items, List<Double> scores, double capacityTonnes) {
        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) order.add(i);
        order.sort((a, b) -> {
            int cmp = Double.compare(scores.get(b), scores.get(a));
            if (cmp != 0) return cmp;
            return Integer.compare(items.get(a).createdRank(), items.get(b).createdRank());
        });
        List<UUID> chosen = new ArrayList<>();
        double tonnes = 0, revenue = 0;
        for (int idx : order) {
            Item i = items.get(idx);
            if (tonnes + i.quantityTonnes() <= capacityTonnes + 1e-9) {
                chosen.add(i.proposalId());
                tonnes += i.quantityTonnes();
                revenue += i.revenue();
            }
        }
        return new Selection(List.copyOf(chosen), round(revenue), round(tonnes), round(capacityTonnes - tonnes), true);
    }

    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }
}
