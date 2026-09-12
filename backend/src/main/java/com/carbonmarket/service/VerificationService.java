package com.carbonmarket.service;

import com.carbonmarket.common.ConflictException;
import com.carbonmarket.common.NotFoundException;
import com.carbonmarket.config.CurrentUser;
import com.carbonmarket.domain.*;
import com.carbonmarket.dto.VerificationDtos.DecideRequest;
import com.carbonmarket.dto.VerificationDtos.VerificationRequestDto;
import com.carbonmarket.repository.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class VerificationService {
    private final VerificationRequestRepository requests;
    private final PassportRepository passports;
    private final AgreementRepository agreements;
    private final CurrentUser current;
    private final Lookup lookup;
    private final AuditService audit;
    private final NotificationService notifications;

    public VerificationService(VerificationRequestRepository requests, PassportRepository passports, AgreementRepository agreements,
                               CurrentUser current, Lookup lookup, AuditService audit, NotificationService notifications) {
        this.requests = requests;
        this.passports = passports;
        this.agreements = agreements;
        this.current = current;
        this.lookup = lookup;
        this.audit = audit;
        this.notifications = notifications;
    }

    @Transactional(readOnly = true)
    public List<VerificationRequestDto> queue() {
        return requests.findByStatusInOrderByPriorityDescSubmittedAtAsc(List.of(VerificationRequestStatus.QUEUED, VerificationRequestStatus.IN_REVIEW))
                .stream().map(this::dto).toList();
    }

    @Transactional(readOnly = true)
    public List<VerificationRequestDto> history() {
        return requests.findByStatusInOrderByDecidedAtDesc(List.of(VerificationRequestStatus.APPROVED, VerificationRequestStatus.REJECTED))
                .stream().map(this::dto).toList();
    }

    @Transactional(readOnly = true)
    public VerificationRequestDto get(UUID id) { return dto(find(id)); }

    @Transactional
    public VerificationRequestDto claim(UUID id) {
        VerificationRequest v = find(id);
        if (v.getStatus() != VerificationRequestStatus.QUEUED) throw new ConflictException("Request is " + v.getStatus());
        v.setStatus(VerificationRequestStatus.IN_REVIEW);
        v.setLabId(current.companyId());
        requests.save(v);
        audit.record("VERIFICATION_CLAIMED", "VerificationRequest", id, AuditService.details("type", v.getType().name()));
        return dto(v);
    }

    @Transactional
    public VerificationRequestDto decide(UUID id, DecideRequest r) {
        VerificationRequest v = find(id);
        if (v.getStatus() == VerificationRequestStatus.APPROVED || v.getStatus() == VerificationRequestStatus.REJECTED) {
            throw new ConflictException("Request already decided");
        }
        v.setLabId(current.companyId());
        v.setMeasuredSpecs(r.measuredSpecs() == null ? new LinkedHashMap<>() : r.measuredSpecs());
        v.setNotes(r.notes());
        v.setDecidedAt(Instant.now());
        v.setStatus(r.approved() ? VerificationRequestStatus.APPROVED : VerificationRequestStatus.REJECTED);
        requests.save(v);

        if (v.getType() == VerificationType.PASSPORT_COA) decidePassport(v, r);
        else decideSale(v, r);

        audit.record(r.approved() ? "VERIFICATION_APPROVED" : "VERIFICATION_REJECTED", "VerificationRequest", id,
                AuditService.details("type", v.getType().name(), "passport", v.getPassportId(), "agreement", v.getAgreementId(), "notes", r.notes()));
        return dto(v);
    }

    private void decidePassport(VerificationRequest v, DecideRequest r) {
        Co2Passport p = passports.findByIdForUpdate(v.getPassportId()).orElseThrow(() -> new NotFoundException("Passport not found"));
        if (r.approved()) {
            int months = r.coaValidMonths() == null ? 6 : Math.max(1, Math.min(6, r.coaValidMonths()));
            p.setVerificationStatus(VerificationStatus.VERIFIED);
            p.setLabCertificateStatus(LabCertificateStatus.ISSUED);
            p.setIssuingLabId(current.companyId());
            p.setCoaIssuedAt(Instant.now());
            p.setCoaExpiresAt(Instant.now().plus(months * 30L, ChronoUnit.DAYS));
            // Lab-measured values override self-reported claims on the passport.
            Object conc = v.getMeasuredSpecs().get("concentrationPct");
            if (conc instanceof Number n) p.setConcentrationPct(n.doubleValue());
            Object imp = v.getMeasuredSpecs().get("impurities");
            if (imp instanceof Map<?, ?> m && !m.isEmpty()) {
                Map<String, Object> merged = new LinkedHashMap<>(p.getImpurities());
                m.forEach((k, val) -> merged.put(String.valueOf(k), val));
                p.setImpurities(merged);
            }
            notifications.notify(p.getEmitterId(), "PASSPORT_VERIFIED", p.getPassportCode() + " verified",
                    "Independent COA issued by " + lookup.companyName(current.companyId()) + ", valid " + months + " months. You can now list this passport.",
                    "Passport", p.getId());
        } else {
            p.setVerificationStatus(VerificationStatus.REJECTED);
            p.setLabCertificateStatus(LabCertificateStatus.NONE);
            notifications.notify(p.getEmitterId(), "PASSPORT_REJECTED", p.getPassportCode() + " rejected by lab",
                    "Measured specs did not match the claim. " + (r.notes() == null ? "" : r.notes()), "Passport", p.getId());
        }
        p.setUpdatedAt(Instant.now());
        passports.save(p);
    }

    private void decideSale(VerificationRequest v, DecideRequest r) {
        Agreement a = lookup.agreement(v.getAgreementId());
        if (a.getStatus() != AgreementStatus.PENDING_VERIFICATION) return;
        if (r.approved()) {
            a.setStatus(AgreementStatus.ACTIVE);
            a.setUpdatedAt(Instant.now());
            agreements.save(a);
            String msg = "Lab approved the sale of " + a.getVolumeTonnes() + " t of " + lookup.passportCode(a.getPassportId()) + ". The agreement is now ACTIVE; shipments can be scheduled.";
            notifications.notify(a.getEmitterId(), "SALE_APPROVED", "Sale approved by lab", msg, "Agreement", a.getId());
            notifications.notify(a.getUtilizerId(), "SALE_APPROVED", "Sale approved by lab", msg, "Agreement", a.getId());
        } else {
            Co2Passport p = passports.findByIdForUpdate(a.getPassportId()).orElseThrow(() -> new NotFoundException("Passport not found"));
            p.setAllocatedTonnes(Math.max(0, p.getAllocatedTonnes() - a.getVolumeTonnes()));
            passports.save(p);
            a.setStatus(AgreementStatus.CANCELLED);
            a.setCancelReason("Rejected by verification lab: " + (r.notes() == null ? "spec mismatch" : r.notes()));
            a.setUpdatedAt(Instant.now());
            agreements.save(a);
            String msg = "Lab rejected the sale on " + p.getPassportCode() + ". Volume released; no trust penalty applied. " + (r.notes() == null ? "" : r.notes());
            notifications.notify(a.getEmitterId(), "SALE_REJECTED", "Sale rejected by lab", msg, "Agreement", a.getId());
            notifications.notify(a.getUtilizerId(), "SALE_REJECTED", "Sale rejected by lab", msg, "Agreement", a.getId());
        }
    }

    @Transactional(readOnly = true)
    public List<VerificationRequestDto> expiring() {
        Instant now = Instant.now();
        return passports.findByCoaExpiresAtBetween(now, now.plus(30, ChronoUnit.DAYS)).stream().map(p -> new VerificationRequestDto(
                null, VerificationType.PASSPORT_COA, 0, null, p.getId(), p.getPassportCode(), lookup.companyName(p.getEmitterId()), null,
                p.getIssuingLabId(), lookup.companyName(p.getIssuingLabId()), PassportService.claimedSpecs(p), Map.of(),
                "COA expires " + p.getCoaExpiresAt(), p.getCoaIssuedAt(), p.getCoaExpiresAt())).toList();
    }

    /** COAs are time-limited: expired ones push the passport back into the lab queue and block new listings. */
    @Scheduled(fixedDelay = 3_600_000, initialDelay = 60_000)
    @Transactional
    public int expireCoas() {
        int n = 0;
        for (Co2Passport p : passports.findByCoaExpiresAtBeforeAndLabCertificateStatus(Instant.now(), LabCertificateStatus.ISSUED)) {
            p.setLabCertificateStatus(LabCertificateStatus.EXPIRED);
            p.setVerificationStatus(VerificationStatus.PENDING);
            p.setUpdatedAt(Instant.now());
            passports.save(p);
            VerificationRequest vr = new VerificationRequest();
            vr.setType(VerificationType.PASSPORT_COA);
            vr.setPassportId(p.getId());
            vr.setPriority(5);
            vr.setClaimedSpecs(PassportService.claimedSpecs(p));
            vr.setNotes("COA expired; re-testing required");
            requests.save(vr);
            notifications.notify(p.getEmitterId(), "COA_EXPIRED", p.getPassportCode() + " COA expired",
                    "The lab certificate expired. The passport is back in the verification queue (priority 5); new listings are blocked until re-tested.",
                    "Passport", p.getId());
            audit.record(null, null, "COA_EXPIRED", "Passport", p.getId(), AuditService.details("code", p.getPassportCode()));
            n++;
        }
        return n;
    }

    private VerificationRequest find(UUID id) {
        return requests.findById(id).orElseThrow(() -> new NotFoundException("Verification request not found"));
    }

    public VerificationRequestDto dto(VerificationRequest v) {
        Co2Passport p = v.getPassportId() == null ? null : passports.findById(v.getPassportId()).orElse(null);
        return new VerificationRequestDto(v.getId(), v.getType(), v.getPriority(), v.getStatus(), v.getPassportId(),
                p == null ? null : p.getPassportCode(), p == null ? null : lookup.companyName(p.getEmitterId()), v.getAgreementId(),
                v.getLabId(), lookup.companyName(v.getLabId()), v.getClaimedSpecs(), v.getMeasuredSpecs(), v.getNotes(),
                v.getSubmittedAt(), v.getDecidedAt());
    }
}
