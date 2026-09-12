package com.carbonmarket.web;

import com.carbonmarket.dto.AgreementDtos.*;
import com.carbonmarket.dto.ShipmentDtos.ShipmentDto;
import com.carbonmarket.dto.ShipmentDtos.ShipmentRequest;
import com.carbonmarket.service.AgreementService;
import com.carbonmarket.service.ContractDocumentService;
import com.carbonmarket.service.NegotiationService;
import com.carbonmarket.service.ShipmentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class AgreementController {
    private final AgreementService agreements;
    private final NegotiationService negotiations;
    private final ShipmentService shipments;
    private final ContractDocumentService documents;

    public AgreementController(AgreementService agreements, NegotiationService negotiations, ShipmentService shipments,
                               ContractDocumentService documents) {
        this.agreements = agreements;
        this.negotiations = negotiations;
        this.shipments = shipments;
        this.documents = documents;
    }

    // ---- Agreements ----
    @GetMapping("/agreements")
    public List<AgreementDto> list() { return agreements.list(); }

    @GetMapping("/agreements/{id}")
    public AgreementDto get(@PathVariable UUID id) { return agreements.get(id); }

    @PostMapping("/agreements/{id}/cancel")
    @PreAuthorize("hasAnyRole('EMITTER','UTILIZER')")
    public AgreementDto cancel(@PathVariable UUID id, @RequestBody(required = false) CancelRequest r) {
        return agreements.cancel(id, r == null || r.reason() == null ? "No reason given" : r.reason());
    }

    @PostMapping("/agreements/{id}/complete")
    @PreAuthorize("hasAnyRole('EMITTER','UTILIZER')")
    public AgreementDto complete(@PathVariable UUID id) { return agreements.complete(id); }

    @GetMapping(value = "/agreements/{id}/document", produces = "text/markdown;charset=UTF-8")
    public ResponseEntity<String> document(@PathVariable UUID id) {
        return ResponseEntity.ok().header("Content-Disposition", "attachment; filename=\"agreement-" + id + ".md\"")
                .contentType(MediaType.parseMediaType("text/markdown;charset=UTF-8")).body(documents.markdown(id));
    }

    @PostMapping("/agreements/{id}/renew")
    @PreAuthorize("hasAnyRole('EMITTER','UTILIZER')")
    public ResponseEntity<NegotiationDto> renew(@PathVariable UUID id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(negotiations.renew(id));
    }

    @PostMapping("/agreements/{id}/shipments")
    @PreAuthorize("hasAnyRole('EMITTER','UTILIZER')")
    public ResponseEntity<ShipmentDto> createShipment(@PathVariable UUID id, @Valid @RequestBody ShipmentRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(shipments.create(id, r));
    }

    // ---- Negotiations ----
    @PostMapping("/negotiations")
    @PreAuthorize("hasAnyRole('EMITTER','UTILIZER')")
    public ResponseEntity<NegotiationDto> open(@Valid @RequestBody NegotiationRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(negotiations.create(r));
    }

    @GetMapping("/negotiations")
    public List<NegotiationDto> negotiations() { return negotiations.list(); }

    @GetMapping("/negotiations/{id}")
    public NegotiationDto negotiation(@PathVariable UUID id) { return negotiations.get(id); }

    @PostMapping("/negotiations/{id}/offers")
    @PreAuthorize("hasAnyRole('EMITTER','UTILIZER')")
    public NegotiationDto counter(@PathVariable UUID id, @Valid @RequestBody OfferRequest r) { return negotiations.counter(id, r); }

    @PostMapping("/negotiations/{id}/offers/{offerId}/accept")
    @PreAuthorize("hasAnyRole('EMITTER','UTILIZER')")
    public NegotiationDto accept(@PathVariable UUID id, @PathVariable UUID offerId) { return negotiations.accept(id, offerId); }

    @PostMapping("/negotiations/{id}/offers/{offerId}/reject")
    @PreAuthorize("hasAnyRole('EMITTER','UTILIZER')")
    public NegotiationDto reject(@PathVariable UUID id, @PathVariable UUID offerId) { return negotiations.reject(id, offerId); }
}
