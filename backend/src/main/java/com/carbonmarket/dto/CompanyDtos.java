package com.carbonmarket.dto;

import com.carbonmarket.domain.*;

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
}
