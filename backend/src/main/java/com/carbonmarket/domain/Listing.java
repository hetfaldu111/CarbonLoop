package com.carbonmarket.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "listings")
public class Listing {
    @Id private UUID id = UUID.randomUUID();
    private UUID passportId;
    private UUID emitterId;
    @Enumerated(EnumType.STRING) private SaleMode mode;
    @Enumerated(EnumType.STRING) private ListingStatus status = ListingStatus.OPEN;
    private double volumeTonnes;
    private double basePricePerTonne;
    private Double minPurityPct;
    private LocalDate deliveryWindowStart;
    private LocalDate deliveryWindowEnd;
    private Instant closesAt;
    private String description;
    private Double reservePricePerTonne;
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getPassportId() { return passportId; }
    public void setPassportId(UUID passportId) { this.passportId = passportId; }
    public UUID getEmitterId() { return emitterId; }
    public void setEmitterId(UUID emitterId) { this.emitterId = emitterId; }
    public SaleMode getMode() { return mode; }
    public void setMode(SaleMode mode) { this.mode = mode; }
    public ListingStatus getStatus() { return status; }
    public void setStatus(ListingStatus status) { this.status = status; }
    public double getVolumeTonnes() { return volumeTonnes; }
    public void setVolumeTonnes(double volumeTonnes) { this.volumeTonnes = volumeTonnes; }
    public double getBasePricePerTonne() { return basePricePerTonne; }
    public void setBasePricePerTonne(double basePricePerTonne) { this.basePricePerTonne = basePricePerTonne; }
    public Double getMinPurityPct() { return minPurityPct; }
    public void setMinPurityPct(Double minPurityPct) { this.minPurityPct = minPurityPct; }
    public LocalDate getDeliveryWindowStart() { return deliveryWindowStart; }
    public void setDeliveryWindowStart(LocalDate deliveryWindowStart) { this.deliveryWindowStart = deliveryWindowStart; }
    public LocalDate getDeliveryWindowEnd() { return deliveryWindowEnd; }
    public void setDeliveryWindowEnd(LocalDate deliveryWindowEnd) { this.deliveryWindowEnd = deliveryWindowEnd; }
    public Instant getClosesAt() { return closesAt; }
    public void setClosesAt(Instant closesAt) { this.closesAt = closesAt; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Double getReservePricePerTonne() { return reservePricePerTonne; }
    public void setReservePricePerTonne(Double reservePricePerTonne) { this.reservePricePerTonne = reservePricePerTonne; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
