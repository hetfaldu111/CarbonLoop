package com.carbonmarket.common;

import com.fasterxml.jackson.core.type.TypeReference;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.LinkedHashMap;
import java.util.Map;

@Converter
public class JsonMapConverter implements AttributeConverter<Map<String, Object>, String> {
    @Override public String convertToDatabaseColumn(Map<String, Object> attribute) { return Json.write(attribute); }
    @Override public Map<String, Object> convertToEntityAttribute(String dbData) {
        Map<String, Object> m = Json.read(dbData, new TypeReference<LinkedHashMap<String, Object>>() {});
        return m == null ? new LinkedHashMap<>() : m;
    }
}
