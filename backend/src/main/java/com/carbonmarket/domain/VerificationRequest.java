package com.carbonmarket.domain;

import com.carbonmarket.common.JsonMapConverter;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "verification_requests")
public class VerificationRequest {
    @Id private UUID id = UUID.randomUUID();
    @Enumerated(EnumType.STRING) private VerificationType type;
    private UUID passportId;
    private UUID agreementId;
    private UUID labId;
    private int priority = 3;
    @Enumerated(EnumType.STRING) private VerificationRequestStatus status = VerificationRequestStatus.QUEUED;
    @Convert(converter = JsonMapConverter.class) private Map<String, Object> claimedSpecs = new LinkedHashMap<>();
    @Convert(converter = JsonMapConverter.class) private Map<String, Object> measuredSpecs = new LinkedHashMap<>();
    private String notes;
    private Instant submittedAt = Instant.now();
    private Instant decidedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public VerificationType getType() { return type; }
    public void setType(VerificationType type) { this.type = type; }
    public UUID getPassportId() { return passportId; }
    public void setPassportId(UUID passportId) { this.passportId = passportId; }
    public UUID getAgreementId() { return agreementId; }
    public void setAgreementId(UUID agreementId) { this.agreementId = agreementId; }
    public UUID getLabId() { return labId; }
    public void setLabId(UUID labId) { this.labId = labId; }
    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }
    public VerificationRequestStatus getStatus() { return status; }
    public void setStatus(VerificationRequestStatus status) { this.status = status; }
    public Map<String, Object> getClaimedSpecs() { return claimedSpecs; }
    public void setClaimedSpecs(Map<String, Object> claimedSpecs) { this.claimedSpecs = claimedSpecs; }
    public Map<String, Object> getMeasuredSpecs() { return measuredSpecs; }
    public void setMeasuredSpecs(Map<String, Object> measuredSpecs) { this.measuredSpecs = measuredSpecs; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Instant getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(Instant submittedAt) { this.submittedAt = submittedAt; }
    public Instant getDecidedAt() { return decidedAt; }
    public void setDecidedAt(Instant decidedAt) { this.decidedAt = decidedAt; }
}
