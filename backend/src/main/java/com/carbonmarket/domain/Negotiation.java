package com.carbonmarket.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "negotiations")
public class Negotiation {
    @Id private UUID id = UUID.randomUUID();
    private UUID passportId;
    private UUID emitterId;
    private UUID utilizerId;
    private UUID initiatedByCompanyId;
    @Enumerated(EnumType.STRING) private NegotiationStatus status = NegotiationStatus.OPEN;
    private UUID agreementId;
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getPassportId() { return passportId; }
    public void setPassportId(UUID passportId) { this.passportId = passportId; }
    public UUID getEmitterId() { return emitterId; }
    public void setEmitterId(UUID emitterId) { this.emitterId = emitterId; }
    public UUID getUtilizerId() { return utilizerId; }
    public void setUtilizerId(UUID utilizerId) { this.utilizerId = utilizerId; }
    public UUID getInitiatedByCompanyId() { return initiatedByCompanyId; }
    public void setInitiatedByCompanyId(UUID initiatedByCompanyId) { this.initiatedByCompanyId = initiatedByCompanyId; }
    public NegotiationStatus getStatus() { return status; }
    public void setStatus(NegotiationStatus status) { this.status = status; }
    public UUID getAgreementId() { return agreementId; }
    public void setAgreementId(UUID agreementId) { this.agreementId = agreementId; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
