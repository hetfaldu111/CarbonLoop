package com.carbonmarket.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "contract_offers")
public class ContractOffer {
    @Id private UUID id = UUID.randomUUID();
    private UUID negotiationId;
    private int version;
    private UUID proposedByCompanyId;
    private double pricePerTonne;
    private double volumePerMonth;
    private int durationMonths;
    @Enumerated(EnumType.STRING) private PricingStructure pricingStructure = PricingStructure.FIXED;
    private boolean takeOrPay;
    private Double supplyGapThresholdPct;
    private Double depositPct;
    private String message;
    @Enumerated(EnumType.STRING) private OfferStatus status = OfferStatus.PENDING;
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getNegotiationId() { return negotiationId; }
    public void setNegotiationId(UUID negotiationId) { this.negotiationId = negotiationId; }
    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
    public UUID getProposedByCompanyId() { return proposedByCompanyId; }
    public void setProposedByCompanyId(UUID proposedByCompanyId) { this.proposedByCompanyId = proposedByCompanyId; }
    public double getPricePerTonne() { return pricePerTonne; }
    public void setPricePerTonne(double pricePerTonne) { this.pricePerTonne = pricePerTonne; }
    public double getVolumePerMonth() { return volumePerMonth; }
    public void setVolumePerMonth(double volumePerMonth) { this.volumePerMonth = volumePerMonth; }
    public int getDurationMonths() { return durationMonths; }
    public void setDurationMonths(int durationMonths) { this.durationMonths = durationMonths; }
    public PricingStructure getPricingStructure() { return pricingStructure; }
    public void setPricingStructure(PricingStructure pricingStructure) { this.pricingStructure = pricingStructure; }
    public boolean isTakeOrPay() { return takeOrPay; }
    public void setTakeOrPay(boolean takeOrPay) { this.takeOrPay = takeOrPay; }
    public Double getSupplyGapThresholdPct() { return supplyGapThresholdPct; }
    public void setSupplyGapThresholdPct(Double supplyGapThresholdPct) { this.supplyGapThresholdPct = supplyGapThresholdPct; }
    public Double getDepositPct() { return depositPct; }
    public void setDepositPct(Double depositPct) { this.depositPct = depositPct; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public OfferStatus getStatus() { return status; }
    public void setStatus(OfferStatus status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
