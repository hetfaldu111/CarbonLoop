package com.carbonmarket.service;

import com.carbonmarket.domain.Co2Passport;
import com.carbonmarket.domain.Company;
import com.carbonmarket.domain.ListingStatus;
import com.carbonmarket.dto.ListingDtos.PublicListingDto;
import com.carbonmarket.dto.MiscDtos.ImpactDto;
import com.carbonmarket.repository.ListingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Non-login endpoints: anonymised aggregate stats and privacy-trimmed open listings. */
@Service
public class PublicService {
    private final RegulatorService regulator;
    private final ListingRepository listings;
    private final Lookup lookup;

    public PublicService(RegulatorService regulator, ListingRepository listings, Lookup lookup) {
        this.regulator = regulator;
        this.listings = listings;
        this.lookup = lookup;
    }

    @Transactional(readOnly = true)
    public ImpactDto impact() { return regulator.impact(); }

    @Transactional(readOnly = true)
    public List<PublicListingDto> listings() {
        return listings.findByStatusOrderByCreatedAtDesc(ListingStatus.OPEN).stream().map(l -> {
            Co2Passport p = lookup.passport(l.getPassportId());
            Company e = lookup.company(l.getEmitterId());
            return new PublicListingDto(l.getId(), l.getMode(), l.getVolumeTonnes(), l.getMinPurityPct(), p.getConcentrationPct(),
                    p.getPhysicalState(), e.getCity(), e.getState(), l.getBasePricePerTonne(), l.getClosesAt());
        }).toList();
    }
}
