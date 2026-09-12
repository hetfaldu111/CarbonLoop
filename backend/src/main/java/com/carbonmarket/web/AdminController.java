package com.carbonmarket.web;

import com.carbonmarket.domain.CompanyStatus;
import com.carbonmarket.dto.CompanyDtos.CompanyDto;
import com.carbonmarket.dto.CompanyDtos.RejectRequest;
import com.carbonmarket.service.CompanyService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    private final CompanyService companies;

    public AdminController(CompanyService companies) { this.companies = companies; }

    @GetMapping("/companies")
    public List<CompanyDto> companies(@RequestParam(required = false) CompanyStatus status) { return companies.list(status); }

    @PostMapping("/companies/{id}/approve")
    public CompanyDto approve(@PathVariable UUID id) { return companies.approve(id); }

    @PostMapping("/companies/{id}/reject")
    public CompanyDto reject(@PathVariable UUID id, @RequestBody(required = false) RejectRequest r) {
        return companies.reject(id, r == null ? null : r.reason());
    }
}
