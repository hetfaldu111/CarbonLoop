package com.carbonmarket.service;

import com.carbonmarket.common.ConflictException;
import com.carbonmarket.common.ForbiddenException;
import com.carbonmarket.common.GeoUtil;
import com.carbonmarket.common.NotFoundException;
import com.carbonmarket.config.CurrentUser;
import com.carbonmarket.domain.*;
import com.carbonmarket.dto.AgreementDtos.AgreementDto;
import com.carbonmarket.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class AgreementService {
    private final AgreementRepository agreements;
    private final PassportRepository passports;
    private final VerificationRequestRepository verifications;
    private final CompanyRepository companies;
    private final CurrentUser current;
    private final Lookup lookup;
    private final TrustService trust;
    private final AuditService audit;
    private final NotificationService notifications;
    private final CostService costs;

    public AgreementService(AgreementRepository agreements, PassportRepository passports, VerificationRequestRepository verifications,
                            CompanyRepository companies, CurrentUser current, Lookup lookup, TrustService trust, AuditService audit,
                            NotificationService notifications, CostService costs) {
        this.agreements = agreements;
        this.passports = passports;
        this.verifications = verifications;
        this.companies = companies;
        this.current = current;
        this.lookup = lookup;
        this.trust = trust;
        this.audit = audit;
        this.notifications = notifications;
        this.costs = costs;
    }

    @Transactional(readOnly = true)
    public List<AgreementDto> list() {
        UUID me = current.companyId();
        List<Agreement> list = current.isOversight() ? agreements.findAllByOrderByCreatedAtDesc()
                : agreements.findByEmitterIdOrUtilizerIdOrderByCreatedAtDesc(me, me);
        return list.stream().map(this::dto).toList();
    }

    @Transactional(readOnly = true)
    public AgreementDto get(UUID id) {
        Agreement a = lookup.agreement(id);
        assertCanView(a);
        return dto(a);
    }

    /** Called by ListingService.award — passport row must already be locked by the caller. */
    @Transactional
    public Agreement createFromAward(Listing l, Proposal p, Co2Passport passport) {
        Company utilizer = lookup.company(p.getUtilizerId());
        Agreement a = new Agreement();
        a.setListingId(l.getId());
        a.setProposalId(p.getId());
        a.setEmitterId(l.getEmitterId());
        a.setUtilizerId(p.getUtilizerId());
        a.setPassportId(passport.getId());
        a.setMode(l.getMode());
        a.setVolumeTonnes(p.getQuantityTonnes());
        a.setPricePerTonne(p.getOfferedPricePerTonne());
        a.setStatus(AgreementStatus.PENDING_VERIFICATION);
        a.setStartsAt(l.getDeliveryWindowStart() == null ? LocalDate.now() : l.getDeliveryWindowStart());
        a.setDurationMonths(Math.max(p.getDurationMonths(), 1));
        a.setEndsAt(l.getDeliveryWindowEnd() != null ? l.getDeliveryWindowEnd() : a.getStartsAt().plusMonths(a.getDurationMonths()));
        a.setDepositPct(p.isAcceptsEscrow() ? 10.0 : 0.0);
        a.setPricingStructure(PricingStructure.FIXED);
        double dist = GeoUtil.distanceKm(passport.getLatitude(), passport.getLongitude(), utilizer.getLatitude(), utilizer.getLongitude());
        a.setCostStack(costs.calculate(l, passport, p.getQuantityTonnes(), p.getRequiredPurityPct(), TransportMode.TRUCK, null, dist).toMap());
        agreements.save(a);

        VerificationRequest vr = new VerificationRequest();
        vr.setType(VerificationType.SALE_APPROVAL);
        vr.setPassportId(passport.getId());
        vr.setAgreementId(a.getId());
        vr.setPriority(4);
        vr.setClaimedSpecs(PassportService.claimedSpecs(passport));
        vr.setNotes("Sale approval: " + p.getQuantityTonnes() + " t of " + passport.getPassportCode() + " to " + utilizer.getName()
                + (p.getRequiredPurityPct() == null ? "" : " (required purity " + p.getRequiredPurityPct() + "%)"));
        verifications.save(vr);

        trust.onAgreementCreated(a.getEmitterId(), a.getUtilizerId());
        for (Company lab : companies.findByRoleAndStatus(Role.LAB, CompanyStatus.APPROVED)) {
            notifications.notify(lab.getId(), "VERIFICATION_QUEUED", "Sale awaiting lab approval",
                    "Agreement on " + passport.getPassportCode() + " needs approval before it becomes active.", "VerificationRequest", vr.getId());
        }
        return a;
    }

    @Transactional
    public AgreementDto cancel(UUID id, String reason) {
        Agreement a = lookup.agreement(id);
        UUID me = current.companyId();
        if (!me.equals(a.getEmitterId()) && !me.equals(a.getUtilizerId())) throw new ForbiddenException("Not a party to this agreement");
        if (a.getStatus() == AgreementStatus.COMPLETED || a.getStatus() == AgreementStatus.CANCELLED) {
            throw new ConflictException("Agreement is already " + a.getStatus());
        }
        Co2Passport p = passports.findByIdForUpdate(a.getPassportId()).orElseThrow(() -> new NotFoundException("Passport not found"));
        p.setAllocatedTonnes(Math.max(0, p.getAllocatedTonnes() - a.getVolumeTonnes()));
        passports.save(p);

        boolean early = a.getEndsAt() == null || LocalDate.now().isBefore(a.getEndsAt());
        a.setStatus(AgreementStatus.CANCELLED);
        a.setCancelledByCompanyId(me);
        a.setCancelReason(reason);
        a.setUpdatedAt(Instant.now());
        agreements.save(a);
        if (early) trust.onAgreementCancelledEarly(me);

        UUID other = me.equals(a.getEmitterId()) ? a.getUtilizerId() : a.getEmitterId();
        String penalty = early ? " Cancelled before expiry: the cancelling party's trust score was penalised"
                + (a.getDepositPct() != null && a.getDepositPct() > 0 ? " and its " + a.getDepositPct() + "% deposit is forfeited." : ".") : "";
        notifications.notify(other, "AGREEMENT_CANCELLED", "Agreement cancelled",
                lookup.companyName(me) + " cancelled the agreement on " + p.getPassportCode() + ". Reason: " + reason + penalty, "Agreement", id);
        audit.record("AGREEMENT_CANCELLED", "Agreement", id, AuditService.details("by", me, "reason", reason, "beforeExpiry", early,
                "releasedTonnes", a.getVolumeTonnes()));
        return dto(a);
    }

    @Transactional
    public AgreementDto complete(UUID id) {
        Agreement a = lookup.agreement(id);
        UUID me = current.companyId();
        if (!me.equals(a.getEmitterId()) && !me.equals(a.getUtilizerId())) throw new ForbiddenException("Not a party to this agreement");
        if (a.getStatus() != AgreementStatus.ACTIVE) throw new ConflictException("Only ACTIVE agreements can be completed");
        // Completed volume is consumed stock: remove it from both the allocation and the passport's remaining total.
        Co2Passport p = passports.findByIdForUpdate(a.getPassportId()).orElseThrow(() -> new NotFoundException("Passport not found"));
        p.setAllocatedTonnes(Math.max(0, p.getAllocatedTonnes() - a.getVolumeTonnes()));
        p.setTotalVolumeTonnes(Math.max(0, p.getTotalVolumeTonnes() - a.getVolumeTonnes()));
        p.setUpdatedAt(Instant.now());
        passports.save(p);
        a.setStatus(AgreementStatus.COMPLETED);
        a.setUpdatedAt(Instant.now());
        agreements.save(a);
        trust.onAgreementCompleted(a.getEmitterId(), a.getUtilizerId());
        UUID other = me.equals(a.getEmitterId()) ? a.getUtilizerId() : a.getEmitterId();
        notifications.notify(other, "AGREEMENT_COMPLETED", "Agreement completed",
                lookup.companyName(me) + " marked the agreement on " + lookup.passportCode(a.getPassportId()) + " as completed. Trust scores updated.",
                "Agreement", id);
        audit.record("AGREEMENT_COMPLETED", "Agreement", id, AuditService.details("by", me, "volumeTonnes", a.getVolumeTonnes()));
        return dto(a);
    }

    public void assertCanView(Agreement a) {
        UUID me = current.companyId();
        if (current.isOversight() || me.equals(a.getEmitterId()) || me.equals(a.getUtilizerId())) return;
        if (current.is(Role.TRANSPORT)) return; // transport sees agreement summary through shipments
        throw new ForbiddenException("Not a party to this agreement");
    }

    public AgreementDto dto(Agreement a) {
        return new AgreementDto(a.getId(), a.getMode(), a.getStatus(), a.getListingId(), a.getProposalId(), a.getNegotiationId(),
                a.getPassportId(), lookup.passportCode(a.getPassportId()), a.getEmitterId(), lookup.companyName(a.getEmitterId()),
                a.getUtilizerId(), lookup.companyName(a.getUtilizerId()), a.getVolumeTonnes(), a.getPricePerTonne(),
                Math.round(a.getVolumeTonnes() * a.getPricePerTonne() * 100.0) / 100.0, a.getStartsAt(), a.getEndsAt(),
                a.getDurationMonths(), a.getVolumePerMonth(), a.getDepositPct(), a.isTakeOrPay(), a.getSupplyGapThresholdPct(),
                a.getPricingStructure(), a.getCostStack(), a.getCancelReason(), a.getCancelledByCompanyId(), a.getCreatedAt(),
                a.getUpdatedAt());
    }
}
