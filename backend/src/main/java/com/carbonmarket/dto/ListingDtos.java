package com.carbonmarket.dto;

import com.carbonmarket.domain.*;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ListingDtos {
    private ListingDtos() {}

    public record ListingRequest(@NotNull UUID passportId, @NotNull SaleMode mode, @NotNull @Positive Double volumeTonnes,
                                 @NotNull @Positive Double basePricePerTonne, Double minPurityPct, LocalDate deliveryWindowStart,
                                 LocalDate deliveryWindowEnd, Instant closesAt, String description, Double reservePricePerTonne,
                                 // TENDER: delivery policy attached to the agreement
                                 Integer deliveryMonths, Double monthlyTonnes,
                                 // AUCTION: fixed step per bid, when bidding opens and how long it runs
                                 Double bidIncrement, Instant scheduledStartAt, Integer durationMinutes) {}

    public record ListingDto(UUID id, UUID passportId, String passportCode, SaleMode mode, ListingStatus status, double volumeTonnes,
                             double basePricePerTonne, Double minPurityPct, Double concentrationPct, PhysicalState physicalState,
                             CarbonOrigin carbonOrigin, String captureTechnology, String city, String state, Double latitude,
                             Double longitude, boolean pipelineConnected, LocalDate deliveryWindowStart, LocalDate deliveryWindowEnd,
                             Instant closesAt, String description, Double reservePricePerTonne, UUID emitterId, String emitterName,
                             Tier emitterTier, Double passportTotalVolume, long proposalCount, Instant createdAt,
                             Integer deliveryMonths, Double monthlyTonnes, Double bidIncrement, Instant scheduledStartAt,
                             Integer durationMinutes, Double currentPricePerTonne, long bidCount) {}

    public record PublicListingDto(UUID id, SaleMode mode, double volumeTonnes, Double minPurityPct, Double concentrationPct,
                                   PhysicalState physicalState, String city, String state, double basePricePerTonne, Instant closesAt) {}

    public record ProposalRequest(@NotNull @Positive Double quantityTonnes, Double requiredPurityPct, Integer durationMonths,
                                  String deliveryRequirement, @NotNull @Positive Double offeredPricePerTonne, Boolean acceptsEscrow,
                                  String otherRequirements) {}

    public record ProposalDto(UUID id, UUID listingId, SaleMode listingMode, String passportCode, UUID utilizerId, String utilizerName,
                              Tier utilizerTier, double quantityTonnes, Double requiredPurityPct, int durationMonths,
                              String deliveryRequirement, double offeredPricePerTonne, boolean acceptsEscrow, String otherRequirements,
                              ProposalStatus status, Double score, Map<String, Object> scoreBreakdown, Integer rank,
                              String recommendation, Instant createdAt) {}

    /** Multi-select award: the emitter may accept any combination that fits the released volume. */
    public record AwardRequest(@NotNull @NotEmpty List<UUID> proposalIds) {}

    public record AwardSuggestionDto(UUID listingId, double capacityTonnes, boolean exact, SelectionDto recommended,
                                     List<SelectionDto> alternatives, String explanation, List<ProposalOptionDto> perProposal) {}

    public record SelectionDto(String label, List<UUID> proposalIds, double totalRevenue, double totalTonnes,
                               double leftoverTonnes, List<String> utilizers) {}

    public record ProposalOptionDto(UUID proposalId, UUID utilizerId, String utilizerName, Tier tier, double quantityTonnes,
                                    double offeredPricePerTonne, double revenue, boolean inRecommendation, Double score,
                                    Map<String, Object> scoreBreakdown, Instant createdAt) {}

    // ---- Live auction ----

    public record BidRequest(Boolean acceptBindingTerms) {}

    public record AuctionBidDto(String displayName, Tier tier, double amountPerTonne, double totalAmount,
                                Instant placedAt, boolean isYou, UUID companyId) {}

    public record AuctionLeaderDto(UUID companyId, String displayName, Tier tier, boolean isYou) {}

    public record AuctionStateDto(UUID listingId, UUID passportId, String passportCode, ListingStatus status,
                                  Instant scheduledStartAt, Instant closesAt, Instant serverTime, long secondsRemaining,
                                  double basePricePerTonne, double bidIncrement, Double currentPricePerTonne,
                                  double nextBidPricePerTonne, double volumeTonnes, Double currentTotal,
                                  AuctionLeaderDto leader, int bidCount, boolean youAreLeading, boolean canBid,
                                  String blockedReason, String bindingTerms, UUID emitterId, String emitterName,
                                  Tier emitterTier, String city, String state, Double concentrationPct,
                                  String captureTechnology, PhysicalState physicalState,
                                  UUID agreementId, List<AuctionBidDto> bids) {}

    public record CostEstimateRequest(@NotNull UUID listingId, @NotNull @Positive Double quantityTonnes, Double requiredPurityPct,
                                      TransportMode transportMode, Map<String, Double> impurityLimits,
                                      Double destinationLatitude, Double destinationLongitude) {}
}
