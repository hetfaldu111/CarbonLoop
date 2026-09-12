package com.carbonmarket.dto;

import com.carbonmarket.domain.AuditEvent;
import com.carbonmarket.domain.Notification;
import com.carbonmarket.domain.Role;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class MiscDtos {
    private MiscDtos() {}

    public record NotificationDto(UUID id, String type, String title, String message, String referenceType, String referenceId,
                                  boolean read, Instant createdAt) {
        public static NotificationDto from(Notification n) {
            return new NotificationDto(n.getId(), n.getType(), n.getTitle(), n.getMessage(), n.getReferenceType(),
                    n.getReferenceId(), n.isRead(), n.getCreatedAt());
        }
    }

    public record AuditEventDto(Long id, Instant occurredAt, UUID actorCompanyId, String actorName, Role actorRole, String action,
                                String entityType, String entityId, Map<String, Object> details, String previousHash, String hash) {
        public static AuditEventDto from(AuditEvent e, String actorName) {
            return new AuditEventDto(e.getId(), e.getOccurredAt(), e.getActorCompanyId(), actorName, e.getActorRole(), e.getAction(),
                    e.getEntityType(), e.getEntityId(), e.getDetails(), e.getPreviousHash(), e.getHash());
        }
    }

    public record RegionStat(String region, double tonnes) {}
    public record SectorStat(String sector, double tonnes) {}

    public record ImpactDto(double totalCo2DivertedTonnes, double tonnesUnderContract, long activeClusters, long verifiedPassports,
                            long activeListings, long completedAgreements, List<RegionStat> byRegion, List<SectorStat> bySector) {}
}
