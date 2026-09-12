package com.carbonmarket.dto;

import com.carbonmarket.domain.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class AgreementDtos {
    private AgreementDtos() {}

    public record AgreementDto(UUID id, SaleMode mode, AgreementStatus status, UUID listingId, UUID proposalId, UUID negotiationId,
                               UUID passportId, String passportCode, UUID emitterId, String emitterName, UUID utilizerId,
                               String utilizerName, double volumeTonnes, double pricePerTonne, double totalValue, LocalDate startsAt,
                               LocalDate endsAt, Integer durationMonths, Double volumePerMonth, Double depositPct, boolean takeOrPay,
                               Double supplyGapThresholdPct, PricingStructure pricingStructure, Map<String, Object> costStack,
                               String cancelReason, UUID cancelledByCompanyId, Instant createdAt, Instant updatedAt) {}

    public record CancelRequest(String reason) {}

    public record OfferRequest(@NotNull @Positive Double pricePerTonne, @NotNull @Positive Double volumePerMonth,
                               @NotNull @Positive Integer durationMonths, PricingStructure pricingStructure, Boolean takeOrPay,
                               Double supplyGapThresholdPct, Double depositPct, String message) {}

    public record NegotiationRequest(@NotNull UUID counterpartyCompanyId, @NotNull UUID passportId, @NotNull OfferRequest offer) {}

    public record ContractOfferDto(UUID id, int version, UUID proposedByCompanyId, String proposedByName, double pricePerTonne,
                                   double volumePerMonth, int durationMonths, PricingStructure pricingStructure, boolean takeOrPay,
                                   Double supplyGapThresholdPct, Double depositPct, String message, OfferStatus status,
                                   double totalVolume, double totalValue, Instant createdAt) {}

    public record NegotiationDto(UUID id, UUID passportId, String passportCode, UUID emitterId, String emitterName, UUID utilizerId,
                                 String utilizerName, UUID initiatedByCompanyId, NegotiationStatus status, UUID agreementId,
                                 List<ContractOfferDto> offers, Instant createdAt) {}
}
