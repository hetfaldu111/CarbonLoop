package com.carbonmarket.config;

import com.carbonmarket.common.ForbiddenException;
import com.carbonmarket.domain.Company;
import com.carbonmarket.domain.Role;
import com.carbonmarket.repository.CompanyRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Resolves the authenticated principal and its company from the SecurityContext. */
@Component
public class CurrentUser {
    private final CompanyRepository companies;

    public CurrentUser(CompanyRepository companies) { this.companies = companies; }

    public AuthUser get() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !(a.getPrincipal() instanceof AuthUser u)) throw new ForbiddenException("Not authenticated");
        return u;
    }

    public UUID companyId() { return get().companyId(); }

    public Role role() { return get().role(); }

    public Company company() {
        return companies.findById(companyId()).orElseThrow(() -> new ForbiddenException("Company not found"));
    }

    public boolean is(Role... roles) { return get().is(roles); }

    public boolean isOversight() { return is(Role.ADMIN, Role.REGULATOR, Role.LAB); }
}
