package com.carbonmarket.scoring;

import com.carbonmarket.domain.SaleMode;
import com.carbonmarket.domain.Tier;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PriorityScoringTest {

    @Test
    void tenderScoreMatchesHandCalculation() {
        // GOLD 75*0.20=15 | hidden 80*0.15=12 | price 4300 vs 4200 → 52.381*0.15=7.857 | volume 250/300=83.333*0.15=12.5
        // duration 12mo → 100*0.10=10 | escrow 100*0.10=10 | distance 300km → 70*0.05=3.5 | cancellations 0
        PriorityScoring.Result r = PriorityScoring.score(new PriorityScoring.Input(SaleMode.TENDER, Tier.GOLD, 80, 10, 0,
                4300, 4200, 250, 300, 12, true, 300));
        assertEquals(70.86, r.total(), 0.01);
        assertEquals(8, r.components().size());
        assertEquals(15.0, r.components().get(0).contribution(), 1e-9);
        assertEquals("cancellationRate", r.components().get(7).name());
        assertEquals(0.0, r.components().get(7).contribution(), 1e-9);
        assertTrue(r.toMap().get("components") instanceof java.util.List<?>);
    }

    @Test
    void auctionWeightsPriceHeavilyAndPenalisesCancellations() {
        // BRONZE 25*0.10=2.5 | hidden 10*0.10=1 | price 5600 vs 5000 → 62*0.45=27.9 | volume fit 100*0.10=10
        // duration weight 0 | escrow 0 | distance 100km → 90*0.05=4.5 | cancel 2/5=0.4 → -40*0.25=-10
        PriorityScoring.Result r = PriorityScoring.score(new PriorityScoring.Input(SaleMode.AUCTION, Tier.BRONZE, 10, 5, 2,
                5600, 5000, 50, 50, 3, false, 100));
        assertEquals(35.9, r.total(), 0.01);
        assertEquals(-10.0, r.components().get(7).contribution(), 1e-9);
    }

    @Test
    void trustOutweighsPriceInTenderMode() {
        PriorityScoring.Result diamondLowPrice = PriorityScoring.score(new PriorityScoring.Input(SaleMode.TENDER, Tier.DIAMOND, 100, 12, 0,
                4000, 4200, 300, 300, 12, true, 400));
        PriorityScoring.Result bronzeHighPrice = PriorityScoring.score(new PriorityScoring.Input(SaleMode.TENDER, Tier.BRONZE, 10, 5, 2,
                4600, 4200, 300, 300, 3, false, 100));
        assertTrue(diamondLowPrice.total() > bronzeHighPrice.total());
    }

    @Test
    void perfectTenderProposalScoresSumOfPositiveWeights() {
        // positive TENDER weights sum to 0.90 → a flawless proposal scores 90; price is capped so it cannot dominate
        PriorityScoring.Result r = PriorityScoring.score(new PriorityScoring.Input(SaleMode.TENDER, Tier.DIAMOND, 100, 20, 0,
                9000, 4200, 300, 300, 24, true, 0));
        assertEquals(90.0, r.total(), 1e-9);
    }
}
