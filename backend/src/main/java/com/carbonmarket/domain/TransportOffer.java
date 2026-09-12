package com.carbonmarket.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "transport_offers")
public class TransportOffer {
    @Id private UUID id = UUID.randomUUID();
    private UUID shipmentId;
    private UUID providerId;
    @Enumerated(EnumType.STRING) private TransportOfferStatus status = TransportOfferStatus.NOTIFIED;
    private Double distanceFromOriginKm;
    private Double quotedPrice;
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getShipmentId() { return shipmentId; }
    public void setShipmentId(UUID shipmentId) { this.shipmentId = shipmentId; }
    public UUID getProviderId() { return providerId; }
    public void setProviderId(UUID providerId) { this.providerId = providerId; }
    public TransportOfferStatus getStatus() { return status; }
    public void setStatus(TransportOfferStatus status) { this.status = status; }
    public Double getDistanceFromOriginKm() { return distanceFromOriginKm; }
    public void setDistanceFromOriginKm(Double distanceFromOriginKm) { this.distanceFromOriginKm = distanceFromOriginKm; }
    public Double getQuotedPrice() { return quotedPrice; }
    public void setQuotedPrice(Double quotedPrice) { this.quotedPrice = quotedPrice; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
