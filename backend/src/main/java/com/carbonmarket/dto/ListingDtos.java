package com.carbonmarket.dto;

import com.carbonmarket.domain.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public final class ListingDtos {
    private ListingDtos() {}

    public record ListingRequest(@NotNull UUID passportId, @NotNull SaleMode mode, @NotNull @Positive Double volumeTonnes,
                                 @NotNull @Positive Double basePricePerTonne, Double minPurityPct, LocalDate deliveryWindowStart,
                                 LocalDate deliveryWindowEnd, Instant closesAt, String description, Double reservePricePerTonne) {}

    public record ListingDto(UUID id, UUID passportId, String passportCode, SaleMode mode, ListingStatus status, double volumeTonnes,
                             double basePricePerTonne, Double minPurityPct, Double concentrationPct, PhysicalState physicalState,
                             CarbonOrigin carbonOrigin, String captureTechnology, String city, String state, Double latitude,
                             Double longitude, boolean pipelineConnected, LocalDate deliveryWindowStart, LocalDate deliveryWindowEnd,
                             Instant closesAt, String description, Double reservePricePerTonne, UUID emitterId, String emitterName,
                             Tier emitterTier, Double passportTotalVolume, long proposalCount, Instant createdAt) {}

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

    public record AwardRequest(@NotNull UUID proposalId) {}

    public record CostEstimateRequest(@NotNull UUID listingId, @NotNull @Positive Double quantityTonnes, Double requiredPurityPct,
                                      TransportMode transportMode, Map<String, Double> impurityLimits,
                                      Double destinationLatitude, Double destinationLongitude) {}
}
