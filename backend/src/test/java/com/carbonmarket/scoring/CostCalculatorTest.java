package com.carbonmarket.scoring;

import com.carbonmarket.common.BadRequestException;
import com.carbonmarket.domain.TransportMode;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CostCalculatorTest {

    @Test
    void fullStackByTruck() {
        CostCalculator.Result r = CostCalculator.calculate(new CostCalculator.Input(100, 4200, 96.8,
                Map.of("SOx", 8.0, "H2O", 30.0), 98.0, Map.of("SOx", 5.0, "H2O", 50.0), TransportMode.TRUCK, 300, false, 0));
        assertEquals(420_000, r.layer(CostCalculator.BASE).amount(), 1e-6);
        // purity gap 1.2 pt × ₹150 × 100 t = 18,000 ; SOx 8 > 5 → ₹120 × 100 = 12,000 ; H2O 30 ≤ 50 → nothing
        assertEquals(30_000, r.layer(CostCalculator.PURIFICATION).amount(), 1e-6);
        assertEquals(2, r.purificationSteps().size());
        // 300 km × 100 t × ₹4 + ₹5,000
        assertEquals(125_000, r.layer(CostCalculator.TRANSPORT).amount(), 1e-6);
        assertEquals(12_000, r.layer(CostCalculator.VERIFICATION).amount(), 1e-6);
        assertEquals(0, r.layer(CostCalculator.PLATFORM).amount(), 1e-6);
        assertEquals(587_000, r.totalDeliveredCost(), 1e-6);
        assertEquals(5_870, r.totalPerTonne(), 1e-6);
        // carbon: leakage 2.0 + 0.3 = 2.3 % → 2.3 t lost, 97.7 t effective; emissions 100×300×0.062/1000 = 1.86 t; net 95.84
        assertEquals(2.3, r.carbon().expectedLeakagePct(), 1e-9);
        assertEquals(97.7, r.carbon().effectiveDeliveredTonnes(), 1e-9);
        assertEquals(1.86, r.carbon().transportEmissionsTonnes(), 1e-9);
        assertEquals(95.84, r.carbon().netCarbonBenefitTonnes(), 1e-9);
    }

    @Test
    void platformFeeAppliesToSubtotal() {
        CostCalculator.Result r = CostCalculator.calculate(new CostCalculator.Input(10, 1000, 99, Map.of(), null, null,
                TransportMode.RAIL, 100, false, 2.0));
        // base 10,000 + transport (100×10×2.5 + 15,000 = 17,500) + verification 12,000 = 39,500 → fee 790
        assertEquals(790, r.layer(CostCalculator.PLATFORM).amount(), 1e-6);
        assertEquals(40_290, r.totalDeliveredCost(), 1e-6);
    }

    @Test
    void pipelineRequiresConnectionAndProximity() {
        assertThrows(BadRequestException.class, () -> CostCalculator.calculate(new CostCalculator.Input(10, 1000, 99, Map.of(), null, null,
                TransportMode.PIPELINE, 50, false, 0)));
        assertThrows(BadRequestException.class, () -> CostCalculator.calculate(new CostCalculator.Input(10, 1000, 99, Map.of(), null, null,
                TransportMode.PIPELINE, 150, true, 0)));
        CostCalculator.Result ok = CostCalculator.calculate(new CostCalculator.Input(10, 1000, 99, Map.of(), null, null,
                TransportMode.PIPELINE, 50, true, 0));
        assertEquals(400, ok.layer(CostCalculator.TRANSPORT).amount(), 1e-6); // 50 × 10 × 0.8
    }
}
