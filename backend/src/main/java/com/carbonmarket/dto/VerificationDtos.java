package com.carbonmarket.dto;

import com.carbonmarket.domain.VerificationRequestStatus;
import com.carbonmarket.domain.VerificationType;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public final class VerificationDtos {
    private VerificationDtos() {}

    public record VerificationRequestDto(UUID id, VerificationType type, int priority, VerificationRequestStatus status,
                                         UUID passportId, String passportCode, String emitterName, UUID agreementId,
                                         UUID labId, String labName, Map<String, Object> claimedSpecs,
                                         Map<String, Object> measuredSpecs, String notes, Instant submittedAt, Instant decidedAt) {}

    public record DecideRequest(@NotNull Boolean approved, Map<String, Object> measuredSpecs, String notes, Integer coaValidMonths) {}
}
