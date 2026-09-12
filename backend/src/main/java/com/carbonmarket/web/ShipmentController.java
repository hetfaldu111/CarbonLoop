package com.carbonmarket.web;

import com.carbonmarket.dto.ShipmentDtos.*;
import com.carbonmarket.service.ShipmentService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/shipments")
public class ShipmentController {
    private final ShipmentService service;

    public ShipmentController(ShipmentService service) { this.service = service; }

    @GetMapping
    public List<ShipmentDto> list() { return service.list(); }

    @GetMapping("/offers")
    @PreAuthorize("hasRole('TRANSPORT')")
    public List<TransportOfferDto> offers() { return service.myOffers(); }

    @PostMapping("/offers/{offerId}/accept")
    @PreAuthorize("hasRole('TRANSPORT')")
    public TransportOfferDto accept(@PathVariable UUID offerId, @RequestBody(required = false) AcceptOfferRequest r) {
        return service.acceptOffer(offerId, r == null ? null : r.quotedPrice());
    }

    @PostMapping("/offers/{offerId}/reject")
    @PreAuthorize("hasRole('TRANSPORT')")
    public TransportOfferDto reject(@PathVariable UUID offerId) { return service.rejectOffer(offerId); }

    @GetMapping("/{id}")
    public ShipmentDto get(@PathVariable UUID id) { return service.get(id); }

    @PostMapping("/{id}/load")
    @PreAuthorize("hasAnyRole('EMITTER','TRANSPORT')")
    public ShipmentDto load(@PathVariable UUID id, @Valid @RequestBody LoadRequest r) { return service.load(id, r); }

    @PostMapping("/{id}/deliver")
    @PreAuthorize("hasAnyRole('UTILIZER','TRANSPORT')")
    public ShipmentDto deliver(@PathVariable UUID id, @Valid @RequestBody DeliverRequest r) { return service.deliver(id, r); }
}
