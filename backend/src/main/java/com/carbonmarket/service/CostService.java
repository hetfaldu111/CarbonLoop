package com.carbonmarket.service;

import com.carbonmarket.common.GeoUtil;
import com.carbonmarket.config.AppProperties;
import com.carbonmarket.config.CurrentUser;
import com.carbonmarket.domain.Co2Passport;
import com.carbonmarket.domain.Company;
import com.carbonmarket.domain.Listing;
import com.carbonmarket.domain.TransportMode;
import com.carbonmarket.dto.ListingDtos.CostEstimateRequest;
import com.carbonmarket.scoring.CostCalculator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class CostService {
    private final Lookup lookup;
    private final CurrentUser current;
    private final AppProperties props;

    public CostService(Lookup lookup, CurrentUser current, AppProperties props) {
        this.lookup = lookup;
        this.current = current;
        this.props = props;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> estimate(CostEstimateRequest r) {
        Listing l = lookup.listing(r.listingId());
        Co2Passport p = lookup.passport(l.getPassportId());
        Company me = current.company();
        Double lat = r.destinationLatitude() != null ? r.destinationLatitude() : me.getLatitude();
        Double lng = r.destinationLongitude() != null ? r.destinationLongitude() : me.getLongitude();
        double distance = GeoUtil.distanceKm(p.getLatitude(), p.getLongitude(), lat, lng);
        CostCalculator.Result res = calculate(l, p, r.quantityTonnes(), r.requiredPurityPct(), r.transportMode(), r.impurityLimits(), distance);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("listingId", l.getId());
        out.putAll(res.toMap());
        return out;
    }

    public CostCalculator.Result calculate(Listing l, Co2Passport p, double qty, Double requiredPurity, TransportMode mode,
                                           Map<String, Double> impurityLimits, double distanceKm) {
        Map<String, Double> ppm = new LinkedHashMap<>();
        if (p.getImpurities() != null) p.getImpurities().forEach((k, v) -> { if (v instanceof Number n) ppm.put(k, n.doubleValue()); });
        return CostCalculator.calculate(new CostCalculator.Input(qty, l.getBasePricePerTonne(),
                p.getConcentrationPct() == null ? 0 : p.getConcentrationPct(), ppm, requiredPurity, impurityLimits,
                mode == null ? TransportMode.TRUCK : mode, distanceKm, p.isPipelineConnected(), props.getPlatformFeePct()));
    }

    /** Cost stack for a price agreed outside a listing (contracts). */
    public CostCalculator.Result calculateForPrice(double pricePerTonne, Co2Passport p, double qty, TransportMode mode, double distanceKm) {
        Map<String, Double> ppm = new LinkedHashMap<>();
        if (p.getImpurities() != null) p.getImpurities().forEach((k, v) -> { if (v instanceof Number n) ppm.put(k, n.doubleValue()); });
        return CostCalculator.calculate(new CostCalculator.Input(qty, pricePerTonne,
                p.getConcentrationPct() == null ? 0 : p.getConcentrationPct(), ppm, null, null,
                mode == null ? TransportMode.TRUCK : mode, distanceKm, p.isPipelineConnected(), props.getPlatformFeePct()));
    }
}
