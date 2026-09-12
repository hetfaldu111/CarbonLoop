package com.carbonmarket.dto;

import com.carbonmarket.domain.CompanyStatus;
import com.carbonmarket.domain.Role;
import com.carbonmarket.domain.Sector;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Map;
import java.util.UUID;

public final class AuthDtos {
    private AuthDtos() {}

    public record RegisterRequest(
            @NotNull Role role,
            @NotBlank String companyName,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8) String password,
            String fullName,
            String contactPhone,
            String address,
            String city,
            String state,
            String country,
            Double latitude,
            Double longitude,
            Sector sector,
            String registrationNumber,
            Map<String, Object> roleProfile) {}

    public record RegisterResponse(UUID companyId, CompanyStatus status, String message) {}

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

    public record UserDto(UUID id, String email, String fullName, Role role, UUID companyId, String companyName,
                          CompanyStatus companyStatus) {}

    public record LoginResponse(String token, UserDto user) {}
}
