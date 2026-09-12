package com.carbonmarket.service;

import com.carbonmarket.common.ConflictException;
import com.carbonmarket.common.ForbiddenException;
import com.carbonmarket.config.AuthUser;
import com.carbonmarket.config.JwtService;
import com.carbonmarket.domain.*;
import com.carbonmarket.dto.AuthDtos.*;
import com.carbonmarket.repository.CompanyRepository;
import com.carbonmarket.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.UUID;

@Service
public class AuthService {
    private final UserRepository users;
    private final CompanyRepository companies;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final TrustService trust;
    private final AuditService audit;
    private final NotificationService notifications;

    public AuthService(UserRepository users, CompanyRepository companies, PasswordEncoder encoder, JwtService jwt,
                       TrustService trust, AuditService audit, NotificationService notifications) {
        this.users = users;
        this.companies = companies;
        this.encoder = encoder;
        this.jwt = jwt;
        this.trust = trust;
        this.audit = audit;
        this.notifications = notifications;
    }

    @Transactional
    public RegisterResponse register(RegisterRequest r) {
        if (r.role() == Role.ADMIN) throw new ForbiddenException("Admin accounts cannot self-register");
        if (users.existsByEmailIgnoreCase(r.email())) throw new ConflictException("Email already registered");

        Company c = new Company();
        c.setName(r.companyName());
        c.setRole(r.role());
        c.setStatus(CompanyStatus.PENDING);
        c.setContactEmail(r.email());
        c.setContactPhone(r.contactPhone());
        c.setAddress(r.address());
        c.setCity(r.city());
        c.setState(r.state());
        c.setCountry(r.country() == null ? "India" : r.country());
        c.setLatitude(r.latitude());
        c.setLongitude(r.longitude());
        c.setSector(r.sector());
        c.setRegistrationNumber(r.registrationNumber());
        c.setRoleProfile(r.roleProfile() == null ? new LinkedHashMap<>() : r.roleProfile());
        companies.save(c);

        User u = new User();
        u.setCompanyId(c.getId());
        u.setEmail(r.email().toLowerCase());
        u.setPasswordHash(encoder.encode(r.password()));
        u.setFullName(r.fullName());
        u.setRole(r.role());
        users.save(u);

        trust.getOrCreate(c.getId());
        audit.record(c.getId(), r.role(), "COMPANY_REGISTERED", "Company", c.getId(),
                AuditService.details("name", c.getName(), "role", r.role().name(), "sector", r.sector()));
        for (Company admin : companies.findByRole(Role.ADMIN)) {
            notifications.notify(admin.getId(), "SIGNUP_PENDING", "New sign-up awaiting verification",
                    c.getName() + " registered as " + r.role() + ". Verify the company (form review + call/visit) before approving.",
                    "Company", c.getId());
        }
        return new RegisterResponse(c.getId(), c.getStatus(), "Registration received. An admin will verify your company before you can log in.");
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest r) {
        User u = users.findByEmailIgnoreCase(r.email()).orElseThrow(() -> new ForbiddenException("Invalid email or password"));
        if (!encoder.matches(r.password(), u.getPasswordHash())) throw new ForbiddenException("Invalid email or password");
        Company c = companies.findById(u.getCompanyId()).orElseThrow(() -> new ForbiddenException("Company not found"));
        if (c.getStatus() == CompanyStatus.PENDING) throw new ForbiddenException("Company approval pending");
        if (c.getStatus() == CompanyStatus.REJECTED) throw new ForbiddenException("Company registration rejected"
                + (c.getRejectionReason() == null ? "" : ": " + c.getRejectionReason()));
        AuthUser au = new AuthUser(u.getId(), c.getId(), u.getEmail(), u.getRole());
        return new LoginResponse(jwt.issue(au), toDto(u, c));
    }

    @Transactional(readOnly = true)
    public UserDto me(AuthUser au) {
        User u = users.findById(au.userId()).orElseThrow(() -> new ForbiddenException("User not found"));
        Company c = companies.findById(u.getCompanyId()).orElseThrow(() -> new ForbiddenException("Company not found"));
        return toDto(u, c);
    }

    private static UserDto toDto(User u, Company c) {
        return new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), c.getId(), c.getName(), c.getStatus());
    }

    /** Used by the seeder. */
    @Transactional
    public User createUser(UUID id, UUID companyId, String email, String password, String fullName, Role role) {
        User u = new User();
        if (id != null) u.setId(id);
        u.setCompanyId(companyId);
        u.setEmail(email.toLowerCase());
        u.setPasswordHash(encoder.encode(password));
        u.setFullName(fullName);
        u.setRole(role);
        return users.save(u);
    }
}
