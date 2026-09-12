package com.carbonmarket.web;

import com.carbonmarket.dto.PassportDtos.*;
import com.carbonmarket.service.PassportService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/passports")
public class PassportController {
    private final PassportService service;

    public PassportController(PassportService service) { this.service = service; }

    @GetMapping
    @PreAuthorize("hasRole('EMITTER')")
    public List<PassportDto> mine() { return service.mine(); }

    @PostMapping
    @PreAuthorize("hasRole('EMITTER')")
    public ResponseEntity<PassportDto> create(@Valid @RequestBody PassportRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(r));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('EMITTER','ADMIN','LAB','REGULATOR')")
    public PassportDto get(@PathVariable UUID id) { return service.get(id); }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('EMITTER')")
    public PassportDto update(@PathVariable UUID id, @Valid @RequestBody PassportRequest r) { return service.update(id, r); }

    @GetMapping("/{id}/public")
    public PassportPublicDto getPublic(@PathVariable UUID id) { return service.getPublic(id); }

    @GetMapping("/{id}/allocation")
    @PreAuthorize("hasAnyRole('EMITTER','ADMIN','LAB','REGULATOR')")
    public AllocationDto allocation(@PathVariable UUID id) { return service.allocation(id); }

    @GetMapping("/{id}/forecasts")
    public List<ForecastDto> forecasts(@PathVariable UUID id) { return service.forecasts(id); }

    @PostMapping("/{id}/forecasts")
    @PreAuthorize("hasRole('EMITTER')")
    public ResponseEntity<ForecastDto> addForecast(@PathVariable UUID id, @Valid @RequestBody ForecastRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addForecast(id, r));
    }
}
