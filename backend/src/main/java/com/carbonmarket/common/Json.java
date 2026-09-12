package com.carbonmarket.common;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

/** Shared ObjectMapper for JSON column converters and hashing. */
public final class Json {
    public static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private Json() {}

    public static String write(Object o) {
        try { return o == null ? null : MAPPER.writeValueAsString(o); }
        catch (Exception e) { throw new IllegalStateException("JSON write failed", e); }
    }

    public static <T> T read(String s, TypeReference<T> type) {
        try { return (s == null || s.isBlank()) ? null : MAPPER.readValue(s, type); }
        catch (Exception e) { throw new IllegalStateException("JSON read failed", e); }
    }
}
