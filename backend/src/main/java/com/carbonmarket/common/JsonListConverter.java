package com.carbonmarket.common;

import com.fasterxml.jackson.core.type.TypeReference;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Converter
public class JsonListConverter implements AttributeConverter<List<Map<String, Object>>, String> {
    @Override public String convertToDatabaseColumn(List<Map<String, Object>> attribute) { return Json.write(attribute); }
    @Override public List<Map<String, Object>> convertToEntityAttribute(String dbData) {
        List<Map<String, Object>> l = Json.read(dbData, new TypeReference<ArrayList<Map<String, Object>>>() {});
        return l == null ? new ArrayList<>() : l;
    }
}
