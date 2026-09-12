package com.carbonmarket.dto;

import com.carbonmarket.domain.ShipmentStatus;
import com.carbonmarket.domain.TransportMode;
import com.carbonmarket.domain.TransportOfferStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ShipmentDtos {
    private ShipmentDtos() {}

    public record ShipmentRequest(@NotNull TransportMode transportMode, Boolean ownTransport, @NotNull @Positive Double volumeTonnes) {}

    public record ShipmentDto(UUID id, UUID agreementId, String passportCode, String emitterName, String utilizerName,
                              UUID transportProviderId, String transportProviderName, boolean ownTransport, TransportMode transportMode,
                              ShipmentStatus status, Double distanceKm, double volumeTonnes, String sealNumber, Double loadedWeightTonnes,
                              Double loadMeterReading, Double loadSamplePurityPct, Instant loadedAt, String deliverySealNumber,
                              Double deliveredWeightTonnes, Double deliveryMeterReading, Double deliverySamplePurityPct,
                              Instant deliveredAt, double leakageTolerancePct, List<String> flags, Double transportCost,
                              Instant createdAt) {}

    public record TransportOfferDto(UUID id, UUID shipmentId, ShipmentDto shipment, TransportOfferStatus status,
                                    Double distanceFromOriginKm, Double quotedPrice, Instant createdAt) {}

    public record AcceptOfferRequest(Double quotedPrice) {}

    public record LoadRequest(@NotBlank String sealNumber, @NotNull @Positive Double loadedWeightTonnes, Double meterReading,
                              Double samplePurityPct) {}

    public record DeliverRequest(@NotBlank String sealNumber, @NotNull @Positive Double deliveredWeightTonnes, Double meterReading,
                                 Double samplePurityPct) {}
}
