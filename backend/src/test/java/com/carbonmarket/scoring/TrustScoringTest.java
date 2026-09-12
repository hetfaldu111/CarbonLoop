package com.carbonmarket.scoring;

import com.carbonmarket.domain.Tier;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TrustScoringTest {

    @Test
    void formulaAndTiers() {
        assertEquals(80.0, TrustScoring.hiddenScore(10, 8, 0));
        assertEquals(Tier.GOLD, TrustScoring.tierFor(80));
        assertEquals(60.0, TrustScoring.hiddenScore(4, 3, 1));   // 75 - 15
        assertEquals(Tier.SILVER, TrustScoring.tierFor(60));
        assertEquals(100.0, TrustScoring.hiddenScore(12, 12, 0));
        assertEquals(Tier.DIAMOND, TrustScoring.tierFor(100));
        assertEquals(10.0, TrustScoring.hiddenScore(5, 2, 2));   // 40 - 30
        assertEquals(Tier.BRONZE, TrustScoring.tierFor(10));
    }

    @Test
    void newCompanyStartsAtFiftySilver() {
        assertEquals(50.0, TrustScoring.hiddenScore(0, 0, 0));
        assertEquals(Tier.SILVER, TrustScoring.tierFor(50));
    }

    @Test
    void clampedAtZero() {
        assertEquals(0.0, TrustScoring.hiddenScore(2, 0, 5));
        assertEquals(Tier.BRONZE, TrustScoring.tierFor(0));
    }
}
