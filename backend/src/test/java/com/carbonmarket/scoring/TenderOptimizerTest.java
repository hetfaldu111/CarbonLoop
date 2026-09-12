package com.carbonmarket.scoring;

import com.carbonmarket.domain.Tier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The optimiser decides which combination of tender proposals the emitter is shown first, so the
 * two worked examples from the brief are pinned here along with the tie-break chain.
 */
class TenderOptimizerTest {

    private static final UUID U1 = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
    private static final UUID U2 = UUID.fromString("00000000-0000-0000-0000-0000000000a2");
    private static final UUID U3 = UUID.fromString("00000000-0000-0000-0000-0000000000a3");

    private static TenderOptimizer.Item item(UUID id, double tonnes, double price, Tier tier, double hidden, int rank) {
        return new TenderOptimizer.Item(id, tonnes, price, tier, hidden, rank);
    }

    @Test
    @DisplayName("case A: two 500 t bids beat one 1000 t bid when together they pay more")
    void caseATwoWinnersBeatOne() {
        // U1 500 t @ 4400 = 22,00,000 ; U2 500 t @ 4300 = 21,50,000 ; together 43,50,000
        // U3 1000 t @ 4200 = 42,00,000 on its own
        List<TenderOptimizer.Item> items = List.of(
                item(U1, 500, 4400, Tier.GOLD, 80, 0),
                item(U2, 500, 4300, Tier.DIAMOND, 100, 1),
                item(U3, 1000, 4200, Tier.BRONZE, 10, 2));

        TenderOptimizer.Selection best = TenderOptimizer.solve(items, 1000);

        assertEquals(2, best.proposalIds().size());
        assertTrue(best.proposalIds().containsAll(List.of(U1, U2)));
        assertEquals(4_350_000.0, best.totalRevenue(), 0.01);
        assertEquals(1000.0, best.totalTonnes(), 0.01);
        assertEquals(0.0, best.leftoverTonnes(), 0.01);
        assertTrue(best.exact());

        TenderOptimizer.Selection single = TenderOptimizer.bestSingle(items, 1000);
        assertEquals(List.of(U3), single.proposalIds());
        assertTrue(best.totalRevenue() > single.totalRevenue(), "the combination must beat the best single bidder");
    }

    @Test
    @DisplayName("case B: the smaller bid that pays more wins, and the rest returns to free stock")
    void caseBPartialAwardLeavesLeftover() {
        // U1 800 t for 1,00,000 total (125/t) ; U2 1000 t for 50,000 total (50/t)
        List<TenderOptimizer.Item> items = List.of(
                item(U1, 800, 125, Tier.SILVER, 60, 0),
                item(U2, 1000, 50, Tier.GOLD, 75, 1));

        TenderOptimizer.Selection best = TenderOptimizer.solve(items, 1000);

        assertEquals(List.of(U1), best.proposalIds());
        assertEquals(100_000.0, best.totalRevenue(), 0.01);
        assertEquals(800.0, best.totalTonnes(), 0.01);
        assertEquals(200.0, best.leftoverTonnes(), 0.01, "the unsold 200 t goes back to the emitter");
    }

    @Test
    @DisplayName("equal revenue is broken by the higher trust tier")
    void tieBrokenByTier() {
        List<TenderOptimizer.Item> items = List.of(
                item(U1, 100, 4000, Tier.BRONZE, 20, 0),
                item(U2, 100, 4000, Tier.DIAMOND, 95, 1));

        TenderOptimizer.Selection best = TenderOptimizer.solve(items, 100);

        assertEquals(List.of(U2), best.proposalIds(), "same money, so the Diamond bidder wins");
        assertEquals(400_000.0, best.totalRevenue(), 0.01);
    }

    @Test
    @DisplayName("equal revenue and equal tier is broken by the earlier submission")
    void tieBrokenBySubmissionTime() {
        List<TenderOptimizer.Item> items = List.of(
                item(U1, 100, 4000, Tier.GOLD, 75, 3),
                item(U2, 100, 4000, Tier.GOLD, 75, 0));

        assertEquals(List.of(U2), TenderOptimizer.solve(items, 100).proposalIds());
    }

    @Test
    @DisplayName("capacity is filled exactly when a perfect combination exists")
    void fillsCapacityExactly() {
        List<TenderOptimizer.Item> items = List.of(
                item(U1, 300, 4000, Tier.GOLD, 75, 0),
                item(U2, 700, 4000, Tier.GOLD, 75, 1),
                item(U3, 900, 4100, Tier.GOLD, 75, 2));

        TenderOptimizer.Selection best = TenderOptimizer.solve(items, 1000);

        assertEquals(1000.0, best.totalTonnes(), 0.01);
        assertEquals(0.0, best.leftoverTonnes(), 0.01);
        assertEquals(4_000_000.0, best.totalRevenue(), 0.01);
    }

    @Test
    @DisplayName("a proposal larger than the volume released is never selected")
    void oversizedProposalExcluded() {
        List<TenderOptimizer.Item> items = List.of(
                item(U1, 5000, 9000, Tier.DIAMOND, 100, 0),
                item(U2, 100, 4000, Tier.BRONZE, 10, 1));

        TenderOptimizer.Selection best = TenderOptimizer.solve(items, 500);

        assertEquals(List.of(U2), best.proposalIds());
        assertEquals(400.0, best.leftoverTonnes(), 0.01);
    }

    @Test
    @DisplayName("no proposals yields an empty selection with the whole volume left over")
    void emptyInput() {
        TenderOptimizer.Selection best = TenderOptimizer.solve(List.of(), 750);
        assertTrue(best.proposalIds().isEmpty());
        assertEquals(0.0, best.totalRevenue(), 0.01);
        assertEquals(750.0, best.leftoverTonnes(), 0.01);
        assertTrue(best.exact());

        TenderOptimizer.Selection none = TenderOptimizer.solve(null, 10);
        assertTrue(none.proposalIds().isEmpty());
    }

    @Test
    @DisplayName("fractional tonnages are handled to a tenth of a tonne")
    void handlesFractionalVolumes() {
        List<TenderOptimizer.Item> items = List.of(
                item(U1, 12.5, 4000, Tier.GOLD, 75, 0),
                item(U2, 7.5, 4200, Tier.GOLD, 75, 1));

        TenderOptimizer.Selection best = TenderOptimizer.solve(items, 20);

        assertEquals(2, best.proposalIds().size());
        assertEquals(20.0, best.totalTonnes(), 0.01);
        assertEquals(12.5 * 4000 + 7.5 * 4200, best.totalRevenue(), 0.01);
    }
}
