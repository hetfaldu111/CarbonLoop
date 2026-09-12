package com.carbonmarket.config;

import com.carbonmarket.domain.Role;

import java.util.UUID;

/** Authenticated principal carried in the SecurityContext. */
public record AuthUser(UUID userId, UUID companyId, String email, Role role) {
    public boolean is(Role... roles) {
        for (Role r : roles) if (r == role) return true;
        return false;
    }
}
