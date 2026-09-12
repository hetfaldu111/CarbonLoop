package com.carbonmarket.service;

import com.carbonmarket.common.BadRequestException;
import com.carbonmarket.common.ConflictException;
import com.carbonmarket.domain.Company;
import com.carbonmarket.domain.CompanyStatus;
import com.carbonmarket.domain.Role;
import com.carbonmarket.domain.TrustProfile;
import com.carbonmarket.dto.CompanyDtos.CompanyDto;
import com.carbonmarket.dto.CompanyDtos.DirectoryEntry;
import com.carbonmarket.repository.CompanyRepository;
import com.carbonmarket.repository.TrustProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class CompanyService {
    private final CompanyRepository companies;
    private final TrustProfileRepository trust;
    private final Lookup lookup;
    private final AuditService audit;
    private final NotificationService notifications;

    public CompanyService(CompanyRepository companies, TrustProfileRepository trust, Lookup lookup, AuditService audit,
                          NotificationService notifications) {
        this.companies = companies;
        this.trust = trust;
        this.lookup = lookup;
        this.audit = audit;
        this.notifications = notifications;
    }

    @Transactional(readOnly = true)
    public CompanyDto get(UUID id) {
        Company c = lookup.company(id);
        return CompanyDto.from(c, trust.findById(id).orElse(null));
    }

    @Transactional(readOnly = true)
    public List<CompanyDto> list(CompanyStatus status) {
        List<Company> list = status == null ? companies.findAllByOrderByCreatedAtAsc() : companies.findByStatusOrderByCreatedAtAsc(status);
        return list.stream().map(c -> CompanyDto.from(c, trust.findById(c.getId()).orElse(null))).toList();
    }

    @Transactional(readOnly = true)
    public List<DirectoryEntry> directory(Role role) {
        if (role == null) throw new BadRequestException("role is required");
        return companies.findByRoleAndStatus(role, CompanyStatus.APPROVED).stream()
                .map(c -> new DirectoryEntry(c.getId(), c.getName(), c.getCity(), c.getState(), c.getSector(),
                        trust.findById(c.getId()).map(TrustProfile::getTier).orElse(null), c.getRole()))
                .toList();
    }

    @Transactional
    public CompanyDto approve(UUID id) {
        Company c = lookup.company(id);
        if (c.getStatus() == CompanyStatus.APPROVED) throw new ConflictException("Company already approved");
        c.setStatus(CompanyStatus.APPROVED);
        c.setApprovedAt(Instant.now());
        c.setRejectionReason(null);
        companies.save(c);
        audit.record("COMPANY_APPROVED", "Company", id, AuditService.details("name", c.getName(), "role", c.getRole().name()));
        notifications.notify(id, "ACCOUNT_APPROVED", "Your company has been verified",
                "Admin verification complete. You can now log in and transact on the marketplace.", "Company", id);
        return CompanyDto.from(c, trust.findById(id).orElse(null));
    }

    @Transactional
    public CompanyDto reject(UUID id, String reason) {
        Company c = lookup.company(id);
        c.setStatus(CompanyStatus.REJECTED);
        c.setRejectionReason(reason);
        companies.save(c);
        audit.record("COMPANY_REJECTED", "Company", id, AuditService.details("name", c.getName(), "reason", reason));
        notifications.notify(id, "ACCOUNT_REJECTED", "Registration rejected", reason == null ? "No reason given." : reason, "Company", id);
        return CompanyDto.from(c, trust.findById(id).orElse(null));
    }
}
