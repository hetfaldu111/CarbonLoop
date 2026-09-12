package com.carbonmarket.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

/**
 * The audit chain is hashed over a canonical rendering of the details payload. PostgreSQL's jsonb
 * reorders object keys and normalises numbers on read, so hashing the raw serialisation reported a
 * false tamper for every event with a non-trivial payload. These tests pin the properties that fix
 * requires: key order and numeric formatting must not change the digest, but content must.
 */
class AuditCanonicalTest {

    @Test
    @DisplayName("key order does not change the canonical form")
    void keyOrderIsIrrelevant() {
        Map<String, Object> insertionOrder = new LinkedHashMap<>();
        insertionOrder.put("utilizer", "Gujarat Methanol Synthesis");
        insertionOrder.put("score", 70.8);
        insertionOrder.put("listingId", "1001");

        Map<String, Object> jsonbOrder = new LinkedHashMap<>();
        jsonbOrder.put("score", 70.8);
        jsonbOrder.put("listingId", "1001");
        jsonbOrder.put("utilizer", "Gujarat Methanol Synthesis");

        assertEquals(AuditService.canonical(insertionOrder), AuditService.canonical(jsonbOrder));
    }

    @Test
    @DisplayName("equivalent numbers render identically regardless of Java type")
    void numericFormattingIsNormalised() {
        assertEquals(AuditService.canonical(Map.of("volume", 350.0)), AuditService.canonical(Map.of("volume", 350)));
        assertEquals(AuditService.canonical(Map.of("price", new java.math.BigDecimal("4200.00"))),
                AuditService.canonical(Map.of("price", 4200L)));
    }

    @Test
    @DisplayName("nested maps and lists are canonicalised recursively, list order preserved")
    void nestedStructuresAreCanonical() {
        Map<String, Object> a = Map.of("components", List.of(Map.of("name", "trustTier", "weight", 0.20),
                Map.of("weight", 0.15, "name", "price")));
        Map<String, Object> b = Map.of("components", List.of(Map.of("weight", 0.2, "name", "trustTier"),
                Map.of("name", "price", "weight", 0.150)));
        assertEquals(AuditService.canonical(a), AuditService.canonical(b));

        Map<String, Object> reordered = Map.of("components", List.of(Map.of("name", "price", "weight", 0.15),
                Map.of("name", "trustTier", "weight", 0.20)));
        assertNotEquals(AuditService.canonical(a), AuditService.canonical(reordered));
    }

    @Test
    @DisplayName("a changed value changes the canonical form, so tampering is still detected")
    void tamperingStillChangesTheDigest() {
        String original = AuditService.canonical(Map.of("volumeTonnes", 350.0, "action", "AWARD"));
        String tampered = AuditService.canonical(Map.of("volumeTonnes", 3500.0, "action", "AWARD"));
        assertNotEquals(original, tampered);
        assertNotEquals(AuditService.sha256(original), AuditService.sha256(tampered));
    }

    @Test
    @DisplayName("null and empty payloads are stable")
    void nullAndEmptyAreStable() {
        assertEquals("null", AuditService.canonical(null));
        assertEquals("{}", AuditService.canonical(new LinkedHashMap<String, Object>()));
    }
}
