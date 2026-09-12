package com.carbonmarket.scoring;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ReconciliationRulesTest {

    @Test
    void cleanDeliveryHasNoFlags() {
        List<String> flags = ReconciliationRules.evaluate(new ReconciliationRules.Input("SEAL-7781", "SEAL-7781", 35.0, 34.6,
                94.5, 94.4, 120450.0, 120485.0, 2.0));
        assertTrue(flags.isEmpty());
    }

    @Test
    void everyRuleFires() {
        // seal differs; 35 → 34.0 = 2.86 % gap > 2 %; purity drift 0.7 > 0.5; meter delta 30 vs 35 t = 14 % > 2 %
        List<String> flags = ReconciliationRules.evaluate(new ReconciliationRules.Input("SEAL-1", "SEAL-2", 35.0, 34.0,
                96.8, 96.1, 120450.0, 120480.0, 2.0));
        assertEquals(List.of(ReconciliationRules.SEAL_MISMATCH, ReconciliationRules.WEIGHT_GAP,
                ReconciliationRules.PURITY_DRIFT, ReconciliationRules.METER_MISMATCH), flags);
    }

    @Test
    void weightGapUsesShipmentTolerance() {
        List<String> flags = ReconciliationRules.evaluate(new ReconciliationRules.Input("S", "S", 100.0, 97.5, null, null, null, null, 2.0));
        assertEquals(List.of(ReconciliationRules.WEIGHT_GAP), flags);
        assertTrue(ReconciliationRules.evaluate(new ReconciliationRules.Input("S", "S", 100.0, 97.5, null, null, null, null, 3.0)).isEmpty());
    }
}
