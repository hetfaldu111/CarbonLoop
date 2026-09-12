package com.carbonmarket.service;

import com.carbonmarket.common.Json;
import com.carbonmarket.config.AuthUser;
import com.carbonmarket.domain.AuditEvent;
import com.carbonmarket.domain.Role;
import com.carbonmarket.repository.AuditEventRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Append-only, hash-chained audit log. Each row's hash covers the previous row's hash, so any
 * edit or deletion breaks the chain (tamper-evident). Single database — not a blockchain.
 */
@Service
public class AuditService {
    private final AuditEventRepository repo;
    private final Object chainLock = new Object();

    public AuditService(AuditEventRepository repo) { this.repo = repo; }

    public AuditEvent record(String action, String entityType, Object entityId, Map<String, Object> details) {
        AuthUser actor = currentActor();
        return record(actor == null ? null : actor.companyId(), actor == null ? null : actor.role(), action, entityType, entityId, details);
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public AuditEvent record(UUID actorCompanyId, Role actorRole, String action, String entityType, Object entityId, Map<String, Object> details) {
        synchronized (chainLock) {
            AuditEvent e = new AuditEvent();
            e.setOccurredAt(Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS)); // DB precision-safe for hashing
            e.setActorCompanyId(actorCompanyId);
            e.setActorRole(actorRole);
            e.setAction(action);
            e.setEntityType(entityType);
            e.setEntityId(entityId == null ? null : entityId.toString());
            e.setDetails(details == null ? new LinkedHashMap<>() : new LinkedHashMap<>(details));
            String prev = repo.findTopByOrderByIdDesc().map(AuditEvent::getHash).orElse("GENESIS");
            e.setPreviousHash(prev);
            e.setHash(sha256(prev + "|" + e.getOccurredAt() + "|" + action + "|" + entityType + "|" + e.getEntityId() + "|" + Json.write(e.getDetails())));
            return repo.saveAndFlush(e);
        }
    }

    /** Verifies the whole chain; returns the id of the first broken row, or null if intact. */
    @Transactional(readOnly = true)
    public Long verifyChain() {
        String prev = "GENESIS";
        for (AuditEvent e : repo.findAll(org.springframework.data.domain.Sort.by("id"))) {
            String expected = sha256(prev + "|" + e.getOccurredAt() + "|" + e.getAction() + "|" + e.getEntityType() + "|" + e.getEntityId() + "|" + Json.write(e.getDetails()));
            if (!expected.equals(e.getHash()) || !prev.equals(e.getPreviousHash())) return e.getId();
            prev = e.getHash();
        }
        return null;
    }

    private static AuthUser currentActor() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getPrincipal() instanceof AuthUser u ? u : null;
    }

    public static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public static Map<String, Object> details(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
        return m;
    }
}
