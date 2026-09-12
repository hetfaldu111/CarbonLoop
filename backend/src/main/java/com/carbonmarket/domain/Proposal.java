package com.carbonmarket.domain;

import com.carbonmarket.common.JsonMapConverter;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "proposals")
public class Proposal {
    @Id private UUID id = UUID.randomUUID();
    private UUID listingId;
    private UUID utilizerId;
    private double quantityTonnes;
    private Double requiredPurityPct;
    private int durationMonths;
    private String deliveryRequirement;
    private double offeredPricePerTonne;
    private boolean acceptsEscrow;
    private String otherRequirements;
    @Enumerated(EnumType.STRING) private ProposalStatus status = ProposalStatus.SUBMITTED;
    private Double score;
    @Convert(converter = JsonMapConverter.class) private Map<String, Object> scoreBreakdown = new LinkedHashMap<>();
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getListingId() { return listingId; }
    public void setListingId(UUID listingId) { this.listingId = listingId; }
    public UUID getUtilizerId() { return utilizerId; }
    public void setUtilizerId(UUID utilizerId) { this.utilizerId = utilizerId; }
    public double getQuantityTonnes() { return quantityTonnes; }
    public void setQuantityTonnes(double quantityTonnes) { this.quantityTonnes = quantityTonnes; }
    public Double getRequiredPurityPct() { return requiredPurityPct; }
    public void setRequiredPurityPct(Double requiredPurityPct) { this.requiredPurityPct = requiredPurityPct; }
    public int getDurationMonths() { return durationMonths; }
    public void setDurationMonths(int durationMonths) { this.durationMonths = durationMonths; }
    public String getDeliveryRequirement() { return deliveryRequirement; }
    public void setDeliveryRequirement(String deliveryRequirement) { this.deliveryRequirement = deliveryRequirement; }
    public double getOfferedPricePerTonne() { return offeredPricePerTonne; }
    public void setOfferedPricePerTonne(double offeredPricePerTonne) { this.offeredPricePerTonne = offeredPricePerTonne; }
    public boolean isAcceptsEscrow() { return acceptsEscrow; }
    public void setAcceptsEscrow(boolean acceptsEscrow) { this.acceptsEscrow = acceptsEscrow; }
    public String getOtherRequirements() { return otherRequirements; }
    public void setOtherRequirements(String otherRequirements) { this.otherRequirements = otherRequirements; }
    public ProposalStatus getStatus() { return status; }
    public void setStatus(ProposalStatus status) { this.status = status; }
    public Double getScore() { return score; }
    public void setScore(Double score) { this.score = score; }
    public Map<String, Object> getScoreBreakdown() { return scoreBreakdown; }
    public void setScoreBreakdown(Map<String, Object> scoreBreakdown) { this.scoreBreakdown = scoreBreakdown; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
