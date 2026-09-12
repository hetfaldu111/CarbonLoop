package com.carbonmarket.domain;

import com.carbonmarket.common.JsonMapConverter;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "audit_events")
public class AuditEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private Instant occurredAt = Instant.now();
    private UUID actorCompanyId;
    @Enumerated(EnumType.STRING) private Role actorRole;
    private String action;
    private String entityType;
    private String entityId;
    @Convert(converter = JsonMapConverter.class) private Map<String, Object> details = new LinkedHashMap<>();
    private String previousHash;
    private String hash;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Instant getOccurredAt() { return occurredAt; }
    public void setOccurredAt(Instant occurredAt) { this.occurredAt = occurredAt; }
    public UUID getActorCompanyId() { return actorCompanyId; }
    public void setActorCompanyId(UUID actorCompanyId) { this.actorCompanyId = actorCompanyId; }
    public Role getActorRole() { return actorRole; }
    public void setActorRole(Role actorRole) { this.actorRole = actorRole; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }
    public Map<String, Object> getDetails() { return details; }
    public void setDetails(Map<String, Object> details) { this.details = details; }
    public String getPreviousHash() { return previousHash; }
    public void setPreviousHash(String previousHash) { this.previousHash = previousHash; }
    public String getHash() { return hash; }
    public void setHash(String hash) { this.hash = hash; }
}
