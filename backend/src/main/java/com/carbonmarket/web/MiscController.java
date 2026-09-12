package com.carbonmarket.web;

import com.carbonmarket.config.AppProperties;
import com.carbonmarket.config.CurrentUser;
import com.carbonmarket.dto.MiscDtos.AuditEventDto;
import com.carbonmarket.dto.MiscDtos.NotificationDto;
import com.carbonmarket.repository.AuditEventRepository;
import com.carbonmarket.scoring.Rates;
import com.carbonmarket.service.AuditService;
import com.carbonmarket.service.Lookup;
import com.carbonmarket.service.NotificationService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class MiscController {
    private final NotificationService notifications;
    private final AuditEventRepository auditRepo;
    private final AuditService audit;
    private final Lookup lookup;
    private final CurrentUser current;
    private final AppProperties props;

    public MiscController(NotificationService notifications, AuditEventRepository auditRepo, AuditService audit, Lookup lookup,
                          CurrentUser current, AppProperties props) {
        this.notifications = notifications;
        this.auditRepo = auditRepo;
        this.audit = audit;
        this.lookup = lookup;
        this.current = current;
        this.props = props;
    }

    // ---- Notifications ----
    @GetMapping("/notifications")
    public List<NotificationDto> notifications() { return notifications.list(current.companyId()); }

    @GetMapping("/notifications/unread-count")
    public Map<String, Long> unread() { return Map.of("count", notifications.unreadCount(current.companyId())); }

    @PostMapping("/notifications/{id}/read")
    public NotificationDto read(@PathVariable UUID id) { return notifications.markRead(current.companyId(), id); }

    @PostMapping("/notifications/read-all")
    public Map<String, Integer> readAll() { return Map.of("updated", notifications.markAllRead(current.companyId())); }

    // ---- Audit ----
    @GetMapping("/audit")
    @PreAuthorize("hasAnyRole('ADMIN','LAB','REGULATOR')")
    public Map<String, Object> audit(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        Page<com.carbonmarket.domain.AuditEvent> p = auditRepo.findAllByOrderByIdDesc(PageRequest.of(page, Math.min(size, 200)));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("content", p.getContent().stream().map(e -> AuditEventDto.from(e, lookup.companyName(e.getActorCompanyId()))).toList());
        out.put("totalElements", p.getTotalElements());
        out.put("totalPages", p.getTotalPages());
        out.put("number", p.getNumber());
        return out;
    }

    @GetMapping("/audit/verify")
    @PreAuthorize("hasAnyRole('ADMIN','LAB','REGULATOR')")
    public Map<String, Object> verifyChain() {
        Long broken = audit.verifyChain();
        return Map.of("intact", broken == null, "firstBrokenId", broken == null ? -1 : broken, "events", auditRepo.count());
    }

    // ---- Meta ----
    @GetMapping("/meta/rates")
    public Map<String, Object> rates() { return Rates.asMap(props.getPlatformFeePct()); }
}
