package com.carbonmarket.scoring;

import com.carbonmarket.domain.Tier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Emitters are badged on how much CO2 they have actually sold, not on completion rate, so the
 * band edges are pinned here.
 */
class EmitterBadgeTest {

    @Test
    @DisplayName("tonnes sold map to the documented bands")
    void bands() {
        assertEquals(Tier.BRONZE, TrustScoring.tierForTonnesSold(0));
        assertEquals(Tier.BRONZE, TrustScoring.tierForTonnesSold(499.9));
        assertEquals(Tier.SILVER, TrustScoring.tierForTonnesSold(500));
        assertEquals(Tier.SILVER, TrustScoring.tierForTonnesSold(1999.9));
        assertEquals(Tier.GOLD, TrustScoring.tierForTonnesSold(2000));
        assertEquals(Tier.GOLD, TrustScoring.tierForTonnesSold(4999.9));
        assertEquals(Tier.DIAMOND, TrustScoring.tierForTonnesSold(5000));
        assertEquals(Tier.DIAMOND, TrustScoring.tierForTonnesSold(250000));
    }

    @Test
    @DisplayName("the utilizer badge still comes from the reliability score, untouched by volume")
    void utilizerBandingUnchanged() {
        assertEquals(Tier.BRONZE, TrustScoring.tierFor(39.9));
        assertEquals(Tier.SILVER, TrustScoring.tierFor(40));
        assertEquals(Tier.GOLD, TrustScoring.tierFor(70));
        assertEquals(Tier.DIAMOND, TrustScoring.tierFor(90));
    }
}
