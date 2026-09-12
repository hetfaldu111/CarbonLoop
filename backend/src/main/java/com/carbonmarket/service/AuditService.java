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
            e.setHash(hashOf(prev, e));
            return repo.saveAndFlush(e);
        }
    }

    /** Verifies the whole chain; returns the id of the first broken row, or null if intact. */
    @Transactional(readOnly = true)
    public Long verifyChain() {
        String prev = "GENESIS";
        for (AuditEvent e : repo.findAll(org.springframework.data.domain.Sort.by("id"))) {
            if (!hashOf(prev, e).equals(e.getHash()) || !prev.equals(e.getPreviousHash())) return e.getId();
            prev = e.getHash();
        }
        return null;
    }

    private static String hashOf(String previousHash, AuditEvent e) {
        return sha256(previousHash + "|" + e.getOccurredAt() + "|" + e.getAction() + "|" + e.getEntityType()
                + "|" + e.getEntityId() + "|" + canonical(e.getDetails()));
    }

    /**
     * Order- and format-independent rendering of the details payload, used only for hashing.
     * PostgreSQL stores details as jsonb, which reorders object keys and normalises numeric
     * literals on the way back out, so hashing the raw serialisation would report a false
     * tamper on every read. Sorting keys and normalising numbers makes the digest depend on
     * the content alone, so it matches whether the column is jsonb or plain text.
     */
    static String canonical(Object value) {
        StringBuilder sb = new StringBuilder();
        canonical(value, sb);
        return sb.toString();
    }

    private static void canonical(Object value, StringBuilder sb) {
        switch (value) {
            case null -> sb.append("null");
            case Map<?, ?> map -> {
                sb.append('{');
                boolean first = true;
                for (String key : new java.util.TreeSet<>(map.keySet().stream().map(String::valueOf).toList())) {
                    if (!first) sb.append(',');
                    first = false;
                    sb.append(Json.write(key)).append(':');
                    canonical(map.get(key), sb);
                }
                sb.append('}');
            }
            case Iterable<?> list -> {
                sb.append('[');
                boolean first = true;
                for (Object item : list) {
                    if (!first) sb.append(',');
                    first = false;
                    canonical(item, sb);
                }
                sb.append(']');
            }
            case Number n -> sb.append(new java.math.BigDecimal(n.toString()).stripTrailingZeros().toPlainString());
            case Boolean b -> sb.append(b);
            default -> sb.append(Json.write(String.valueOf(value)));
        }
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
