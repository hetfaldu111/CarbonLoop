package com.carbonmarket.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "trust_profiles")
public class TrustProfile {
    @Id private UUID companyId;
    private int totalAgreements;
    private int completedAgreements;
    private int cancellationsBeforeExpiry;
    private double hiddenScore = 50;
    @Enumerated(EnumType.STRING) private Tier tier = Tier.SILVER;
    private Instant updatedAt = Instant.now();

    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }
    public int getTotalAgreements() { return totalAgreements; }
    public void setTotalAgreements(int totalAgreements) { this.totalAgreements = totalAgreements; }
    public int getCompletedAgreements() { return completedAgreements; }
    public void setCompletedAgreements(int completedAgreements) { this.completedAgreements = completedAgreements; }
    public int getCancellationsBeforeExpiry() { return cancellationsBeforeExpiry; }
    public void setCancellationsBeforeExpiry(int cancellationsBeforeExpiry) { this.cancellationsBeforeExpiry = cancellationsBeforeExpiry; }
    public double getHiddenScore() { return hiddenScore; }
    public void setHiddenScore(double hiddenScore) { this.hiddenScore = hiddenScore; }
    public Tier getTier() { return tier; }
    public void setTier(Tier tier) { this.tier = tier; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public double cancellationRate() {
        return totalAgreements == 0 ? 0 : (double) cancellationsBeforeExpiry / totalAgreements;
    }
}
