package com.carbonmarket.dto;

import com.carbonmarket.domain.*;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class CompanyDtos {
    private CompanyDtos() {}

    public record CompanyDto(UUID id, String name, Role role, CompanyStatus status, String contactEmail, String contactPhone,
                             String address, String city, String state, String country, Double latitude, Double longitude,
                             Sector sector, String registrationNumber, Map<String, Object> roleProfile, String rejectionReason,
                             Instant createdAt, Instant approvedAt, Tier tier, Double hiddenScore) {
        public static CompanyDto from(Company c, TrustProfile t) {
            return new CompanyDto(c.getId(), c.getName(), c.getRole(), c.getStatus(), c.getContactEmail(), c.getContactPhone(),
                    c.getAddress(), c.getCity(), c.getState(), c.getCountry(), c.getLatitude(), c.getLongitude(), c.getSector(),
                    c.getRegistrationNumber(), c.getRoleProfile(), c.getRejectionReason(), c.getCreatedAt(), c.getApprovedAt(),
                    t == null ? null : t.getTier(), t == null ? null : t.getHiddenScore());
        }
    }

    public record DirectoryEntry(UUID id, String name, String city, String state, Sector sector, Tier tier, Role role) {}

    public record TrustDto(UUID companyId, String companyName, Tier tier, double hiddenScore, int totalAgreements,
                           int completedAgreements, int cancellationsBeforeExpiry, double cancellationRate,
                           double completionRate, String formula, double tonnesSold, String badgeBasis) {}

    public record RejectRequest(String reason) {}

    public record RegulatorCompanyRow(UUID id, String name, Role role, Sector sector, String city, String state,
                                      CompanyStatus status, Tier tier, double hiddenScore, List<String> complianceFlags,
                                      List<String> incentiveFlags, int verifiedPassports, int totalAgreements, int flaggedShipments) {}

    /**
     * The fields a company may correct itself. Name, role, sector, registration number and
     * status are deliberately absent: an admin verified those, so changing them would let a
     * company become something different from what was approved.
     */
    public record UpdateProfileRequest(
            @NotBlank(message = "Contact phone is required") String contactPhone,
            @NotBlank(message = "Street address is required") String address,
            @NotBlank(message = "City is required") String city,
            @NotBlank(message = "State is required") String state,
            @NotBlank(message = "Country is required") String country,
            @NotNull(message = "Latitude is required")
            @DecimalMin(value = "-90", message = "Latitude must be between -90 and 90")
            @DecimalMax(value = "90", message = "Latitude must be between -90 and 90") Double latitude,
            @NotNull(message = "Longitude is required")
            @DecimalMin(value = "-180", message = "Longitude must be between -180 and 180")
            @DecimalMax(value = "180", message = "Longitude must be between -180 and 180") Double longitude,
            Map<String, Object> roleProfile) {}
}
