package com.carbonmarket.service;

import com.carbonmarket.common.NotFoundException;
import com.carbonmarket.domain.*;
import com.carbonmarket.repository.*;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Small shared lookups used by many services (names, entities-or-404). */
@Component
public class Lookup {
    private final CompanyRepository companies;
    private final PassportRepository passports;
    private final ListingRepository listings;
    private final AgreementRepository agreements;
    private final TrustProfileRepository trust;

    public Lookup(CompanyRepository companies, PassportRepository passports, ListingRepository listings,
                  AgreementRepository agreements, TrustProfileRepository trust) {
        this.companies = companies;
        this.passports = passports;
        this.listings = listings;
        this.agreements = agreements;
        this.trust = trust;
    }

    public String companyName(UUID id) {
        return id == null ? null : companies.findById(id).map(Company::getName).orElse(null);
    }

    public Tier tier(UUID companyId) {
        return companyId == null ? null : trust.findById(companyId).map(TrustProfile::getTier).orElse(Tier.SILVER);
    }

    public Company company(UUID id) {
        return companies.findById(id).orElseThrow(() -> new NotFoundException("Company not found: " + id));
    }

    public Co2Passport passport(UUID id) {
        return passports.findById(id).orElseThrow(() -> new NotFoundException("Passport not found: " + id));
    }

    public Listing listing(UUID id) {
        return listings.findById(id).orElseThrow(() -> new NotFoundException("Listing not found: " + id));
    }

    public Agreement agreement(UUID id) {
        return agreements.findById(id).orElseThrow(() -> new NotFoundException("Agreement not found: " + id));
    }

    public String passportCode(UUID id) {
        return id == null ? null : passports.findById(id).map(Co2Passport::getPassportCode).orElse(null);
    }
}
