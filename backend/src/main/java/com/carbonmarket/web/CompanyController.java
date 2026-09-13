package com.carbonmarket.web;

import com.carbonmarket.config.CurrentUser;
import com.carbonmarket.domain.Role;
import com.carbonmarket.dto.CompanyDtos.CompanyDto;
import com.carbonmarket.dto.CompanyDtos.DirectoryEntry;
import com.carbonmarket.dto.CompanyDtos.TrustDto;
import com.carbonmarket.dto.CompanyDtos.UpdateProfileRequest;
import jakarta.validation.Valid;
import com.carbonmarket.service.CompanyService;
import com.carbonmarket.service.TrustService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/companies")
public class CompanyController {
    private final CompanyService companies;
    private final TrustService trust;
    private final CurrentUser current;

    public CompanyController(CompanyService companies, TrustService trust, CurrentUser current) {
        this.companies = companies;
        this.trust = trust;
        this.current = current;
    }

    @GetMapping("/me")
    public CompanyDto me() { return companies.get(current.companyId()); }

    @PutMapping("/me")
    public CompanyDto updateMe(@Valid @RequestBody UpdateProfileRequest r) {
        return companies.updateProfile(current.companyId(), r);
    }

    @GetMapping("/me/trust")
    public TrustDto myTrust() { return trust.dto(current.companyId()); }

    @GetMapping("/{id}/trust")
    public TrustDto trust(@PathVariable UUID id) { return trust.dto(id); }

    @GetMapping("/directory")
    public List<DirectoryEntry> directory(@RequestParam Role role) { return companies.directory(role); }
}
