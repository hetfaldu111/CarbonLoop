package com.carbonmarket.web;

import com.carbonmarket.dto.VerificationDtos.DecideRequest;
import com.carbonmarket.dto.VerificationDtos.VerificationRequestDto;
import com.carbonmarket.service.VerificationService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/verification")
@PreAuthorize("hasAnyRole('LAB','ADMIN','REGULATOR')")
public class VerificationController {
    private final VerificationService service;

    public VerificationController(VerificationService service) { this.service = service; }

    @GetMapping("/queue")
    public List<VerificationRequestDto> queue() { return service.queue(); }

    @GetMapping("/history")
    public List<VerificationRequestDto> history() { return service.history(); }

    @GetMapping("/expiring")
    public List<VerificationRequestDto> expiring() { return service.expiring(); }

    @GetMapping("/{id}")
    public VerificationRequestDto get(@PathVariable UUID id) { return service.get(id); }

    @PostMapping("/{id}/claim")
    @PreAuthorize("hasRole('LAB')")
    public VerificationRequestDto claim(@PathVariable UUID id) { return service.claim(id); }

    @PostMapping("/{id}/decide")
    @PreAuthorize("hasRole('LAB')")
    public VerificationRequestDto decide(@PathVariable UUID id, @Valid @RequestBody DecideRequest r) { return service.decide(id, r); }
}
