package com.carbonmarket.web;

import com.carbonmarket.dto.ListingDtos.AuctionStateDto;
import com.carbonmarket.dto.ListingDtos.BidRequest;
import com.carbonmarket.service.AuctionService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class AuctionController {
    private final AuctionService auctions;

    public AuctionController(AuctionService auctions) { this.auctions = auctions; }

    /** Live state of one auction. Safe to poll every couple of seconds. */
    @GetMapping("/listings/{id}/auction")
    public AuctionStateDto state(@PathVariable UUID id) { return auctions.state(id); }

    @PostMapping("/listings/{id}/bids")
    @PreAuthorize("hasRole('UTILIZER')")
    public AuctionStateDto bid(@PathVariable UUID id, @Valid @RequestBody(required = false) BidRequest r) {
        return auctions.placeBid(id, r);
    }

    /** filter = live | upcoming | ended | all */
    @GetMapping("/auctions")
    public List<AuctionStateDto> list(@RequestParam(required = false) String filter) { return auctions.list(filter); }

    @GetMapping("/auctions/mine")
    @PreAuthorize("hasRole('EMITTER')")
    public List<AuctionStateDto> mine() { return auctions.mine(); }
}
