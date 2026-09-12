package com.carbonmarket.dto;

import com.carbonmarket.domain.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class PassportDtos {
    private PassportDtos() {}

    public record PassportRequest(
            String source, CarbonOrigin carbonOrigin, String captureTechnology,
            Double dailyTonnage, Double dailyTonnageMin, Double dailyTonnageMax,
            @NotNull @Positive Double totalVolumeTonnes,
            Double concentrationPct, PhysicalState physicalState, Double pressureBar, Double temperatureC,
            Map<String, Object> impurities, Instant captureTimestamp, String meterId, String locationName,
            Double latitude, Double longitude, LocalDate availabilityStart, LocalDate availabilityEnd,
            Boolean pipelineConnected, List<Map<String, Object>> certifications, Map<String, Object> extraAttributes) {}

    public record PassportDto(UUID id, String passportCode, UUID emitterId, String emitterName, String source,
                              CarbonOrigin carbonOrigin, String captureTechnology, Double dailyTonnage, Double dailyTonnageMin,
                              Double dailyTonnageMax, double totalVolumeTonnes, double allocatedTonnes, double freeTonnes,
                              Double concentrationPct, PhysicalState physicalState, Double pressureBar, Double temperatureC,
                              Map<String, Object> impurities, LabCertificateStatus labCertificateStatus, UUID issuingLabId,
                              String issuingLabName, Instant coaIssuedAt, Instant coaExpiresAt, Instant captureTimestamp,
                              String meterId, String locationName, Double latitude, Double longitude,
                              LocalDate availabilityStart, LocalDate availabilityEnd, boolean pipelineConnected,
                              List<Map<String, Object>> certifications, VerificationStatus verificationStatus,
                              MrvStatus mrvStatus, Map<String, Object> extraAttributes, Instant createdAt, Instant updatedAt) {
        public static PassportDto from(Co2Passport p, String emitterName, String labName) {
            return new PassportDto(p.getId(), p.getPassportCode(), p.getEmitterId(), emitterName, p.getSource(), p.getCarbonOrigin(),
                    p.getCaptureTechnology(), p.getDailyTonnage(), p.getDailyTonnageMin(), p.getDailyTonnageMax(),
                    p.getTotalVolumeTonnes(), p.getAllocatedTonnes(), p.freeTonnes(), p.getConcentrationPct(), p.getPhysicalState(),
                    p.getPressureBar(), p.getTemperatureC(), p.getImpurities(), p.getLabCertificateStatus(), p.getIssuingLabId(),
                    labName, p.getCoaIssuedAt(), p.getCoaExpiresAt(), p.getCaptureTimestamp(), p.getMeterId(), p.getLocationName(),
                    p.getLatitude(), p.getLongitude(), p.getAvailabilityStart(), p.getAvailabilityEnd(), p.isPipelineConnected(),
                    p.getCertifications(), p.getVerificationStatus(), p.getMrvStatus(), p.getExtraAttributes(), p.getCreatedAt(),
                    p.getUpdatedAt());
        }
    }

    /** Privacy-trimmed view for non-owners: no total volume, no meter id. */
    public record PassportPublicDto(UUID id, String passportCode, String source, CarbonOrigin carbonOrigin, String captureTechnology,
                                    Double dailyTonnage, Double concentrationPct, PhysicalState physicalState, Double pressureBar,
                                    Double temperatureC, Map<String, Object> impurities, LabCertificateStatus labCertificateStatus,
                                    String issuingLabName, Instant coaIssuedAt, Instant coaExpiresAt, String locationName,
                                    String city, String state, Double latitude, Double longitude, LocalDate availabilityStart,
                                    LocalDate availabilityEnd, boolean pipelineConnected, VerificationStatus verificationStatus,
                                    MrvStatus mrvStatus, Map<String, Object> extraAttributes) {}

    public record AllocationLine(UUID id, SaleMode mode, String status, double volumeTonnes, String counterparty) {}

    public record AllocationDto(UUID passportId, String passportCode, double totalVolumeTonnes, double allocatedTonnes,
                                double allocatedTender, double allocatedAuction, double allocatedContract, double freeTonnes,
                                List<AllocationLine> listings, List<AllocationLine> agreements) {}

    public record ForecastRequest(@NotNull LocalDate periodStart, @NotNull LocalDate periodEnd,
                                  @NotNull Double expectedTonnesPerDay, String reason) {}

    public record ForecastDto(UUID id, UUID passportId, LocalDate periodStart, LocalDate periodEnd, double expectedTonnesPerDay,
                              Double baselineTonnesPerDay, Double shortfallPct, String reason, Instant createdAt, int utilizersNotified) {}
}
