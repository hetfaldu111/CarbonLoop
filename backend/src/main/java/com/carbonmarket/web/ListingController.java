package com.carbonmarket.web;

import com.carbonmarket.domain.ListingStatus;
import com.carbonmarket.domain.SaleMode;
import com.carbonmarket.dto.AgreementDtos.AgreementDto;
import com.carbonmarket.dto.ListingDtos.*;
import com.carbonmarket.service.CostService;
import com.carbonmarket.service.ListingService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ListingController {
    private final ListingService service;
    private final CostService costs;

    public ListingController(ListingService service, CostService costs) { this.service = service; this.costs = costs; }

    @PostMapping("/listings")
    @PreAuthorize("hasRole('EMITTER')")
    public ResponseEntity<ListingDto> create(@Valid @RequestBody ListingRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(r));
    }

    @GetMapping("/listings")
    public List<ListingDto> discover(@RequestParam(required = false) SaleMode mode, @RequestParam(required = false) ListingStatus status,
                                     @RequestParam(required = false) Double minPurity, @RequestParam(required = false) String state) {
        return service.discover(mode, status, minPurity, state);
    }

    @GetMapping("/listings/mine")
    @PreAuthorize("hasRole('EMITTER')")
    public List<ListingDto> mine() { return service.mine(); }

    @GetMapping("/listings/{id}")
    public ListingDto get(@PathVariable UUID id) { return service.get(id); }

    @PostMapping("/listings/{id}/cancel")
    @PreAuthorize("hasRole('EMITTER')")
    public ListingDto cancel(@PathVariable UUID id) { return service.cancel(id); }

    @PostMapping("/listings/{id}/proposals")
    @PreAuthorize("hasRole('UTILIZER')")
    public ResponseEntity<ProposalDto> propose(@PathVariable UUID id, @Valid @RequestBody ProposalRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.submitProposal(id, r));
    }

    @GetMapping("/listings/{id}/proposals")
    public List<ProposalDto> proposals(@PathVariable UUID id) { return service.proposalsFor(id); }

    /** The profit-optimal combination, with alternatives and per-proposal reliability scores. */
    @GetMapping("/listings/{id}/award-suggestion")
    @PreAuthorize("hasAnyRole('EMITTER','ADMIN','REGULATOR')")
    public AwardSuggestionDto awardSuggestion(@PathVariable UUID id) { return service.awardSuggestion(id); }

    /** Accepts one or more proposals; unawarded volume returns to the free stock. */
    @PostMapping("/listings/{id}/award")
    @PreAuthorize("hasRole('EMITTER')")
    public List<AgreementDto> award(@PathVariable UUID id, @Valid @RequestBody AwardRequest r) {
        return service.award(id, r.proposalIds());
    }

    @GetMapping("/proposals/mine")
    @PreAuthorize("hasRole('UTILIZER')")
    public List<ProposalDto> myProposals() { return service.myProposals(); }

    @PostMapping("/proposals/{id}/withdraw")
    @PreAuthorize("hasRole('UTILIZER')")
    public ProposalDto withdraw(@PathVariable UUID id) { return service.withdraw(id); }

    @PostMapping("/costs/estimate")
    public Map<String, Object> estimate(@Valid @RequestBody CostEstimateRequest r) { return costs.estimate(r); }
}
