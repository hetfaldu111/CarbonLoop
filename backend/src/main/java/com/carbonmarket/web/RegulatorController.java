package com.carbonmarket.web;

import com.carbonmarket.dto.CompanyDtos.RegulatorCompanyRow;
import com.carbonmarket.service.RegulatorService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/regulator")
@PreAuthorize("hasAnyRole('REGULATOR','ADMIN')")
public class RegulatorController {
    private final RegulatorService service;

    public RegulatorController(RegulatorService service) { this.service = service; }

    @GetMapping("/overview")
    public Map<String, Object> overview() { return service.overview(); }

    @GetMapping("/companies")
    public List<RegulatorCompanyRow> companies() { return service.companies(); }

    @GetMapping("/companies/{id}")
    public Map<String, Object> company(@PathVariable UUID id) { return service.companyDetail(id); }
}
