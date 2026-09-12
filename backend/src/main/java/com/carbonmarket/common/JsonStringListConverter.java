package com.carbonmarket.common;

import com.fasterxml.jackson.core.type.TypeReference;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.ArrayList;
import java.util.List;

@Converter
public class JsonStringListConverter implements AttributeConverter<List<String>, String> {
    @Override public String convertToDatabaseColumn(List<String> attribute) { return Json.write(attribute); }
    @Override public List<String> convertToEntityAttribute(String dbData) {
        List<String> l = Json.read(dbData, new TypeReference<ArrayList<String>>() {});
        return l == null ? new ArrayList<>() : l;
    }
}
