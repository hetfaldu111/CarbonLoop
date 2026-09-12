package com.carbonmarket.domain;

import com.carbonmarket.common.JsonMapConverter;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "agreements")
public class Agreement {
    @Id private UUID id = UUID.randomUUID();
    private UUID listingId;
    private UUID proposalId;
    private UUID negotiationId;
    private UUID emitterId;
    private UUID utilizerId;
    private UUID passportId;
    @Enumerated(EnumType.STRING) private SaleMode mode;
    private double volumeTonnes;
    private double pricePerTonne;
    @Enumerated(EnumType.STRING) private AgreementStatus status = AgreementStatus.PENDING_VERIFICATION;
    @Convert(converter = JsonMapConverter.class) private Map<String, Object> costStack = new LinkedHashMap<>();
    private LocalDate startsAt;
    private LocalDate endsAt;
    private Integer durationMonths;
    private Double volumePerMonth;
    private Double depositPct;
    private boolean takeOrPay;
    private Double supplyGapThresholdPct;
    @Enumerated(EnumType.STRING) private PricingStructure pricingStructure;
    private UUID cancelledByCompanyId;
    private String cancelReason;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getListingId() { return listingId; }
    public void setListingId(UUID listingId) { this.listingId = listingId; }
    public UUID getProposalId() { return proposalId; }
    public void setProposalId(UUID proposalId) { this.proposalId = proposalId; }
    public UUID getNegotiationId() { return negotiationId; }
    public void setNegotiationId(UUID negotiationId) { this.negotiationId = negotiationId; }
    public UUID getEmitterId() { return emitterId; }
    public void setEmitterId(UUID emitterId) { this.emitterId = emitterId; }
    public UUID getUtilizerId() { return utilizerId; }
    public void setUtilizerId(UUID utilizerId) { this.utilizerId = utilizerId; }
    public UUID getPassportId() { return passportId; }
    public void setPassportId(UUID passportId) { this.passportId = passportId; }
    public SaleMode getMode() { return mode; }
    public void setMode(SaleMode mode) { this.mode = mode; }
    public double getVolumeTonnes() { return volumeTonnes; }
    public void setVolumeTonnes(double volumeTonnes) { this.volumeTonnes = volumeTonnes; }
    public double getPricePerTonne() { return pricePerTonne; }
    public void setPricePerTonne(double pricePerTonne) { this.pricePerTonne = pricePerTonne; }
    public AgreementStatus getStatus() { return status; }
    public void setStatus(AgreementStatus status) { this.status = status; }
    public Map<String, Object> getCostStack() { return costStack; }
    public void setCostStack(Map<String, Object> costStack) { this.costStack = costStack; }
    public LocalDate getStartsAt() { return startsAt; }
    public void setStartsAt(LocalDate startsAt) { this.startsAt = startsAt; }
    public LocalDate getEndsAt() { return endsAt; }
    public void setEndsAt(LocalDate endsAt) { this.endsAt = endsAt; }
    public Integer getDurationMonths() { return durationMonths; }
    public void setDurationMonths(Integer durationMonths) { this.durationMonths = durationMonths; }
    public Double getVolumePerMonth() { return volumePerMonth; }
    public void setVolumePerMonth(Double volumePerMonth) { this.volumePerMonth = volumePerMonth; }
    public Double getDepositPct() { return depositPct; }
    public void setDepositPct(Double depositPct) { this.depositPct = depositPct; }
    public boolean isTakeOrPay() { return takeOrPay; }
    public void setTakeOrPay(boolean takeOrPay) { this.takeOrPay = takeOrPay; }
    public Double getSupplyGapThresholdPct() { return supplyGapThresholdPct; }
    public void setSupplyGapThresholdPct(Double supplyGapThresholdPct) { this.supplyGapThresholdPct = supplyGapThresholdPct; }
    public PricingStructure getPricingStructure() { return pricingStructure; }
    public void setPricingStructure(PricingStructure pricingStructure) { this.pricingStructure = pricingStructure; }
    public UUID getCancelledByCompanyId() { return cancelledByCompanyId; }
    public void setCancelledByCompanyId(UUID cancelledByCompanyId) { this.cancelledByCompanyId = cancelledByCompanyId; }
    public String getCancelReason() { return cancelReason; }
    public void setCancelReason(String cancelReason) { this.cancelReason = cancelReason; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
