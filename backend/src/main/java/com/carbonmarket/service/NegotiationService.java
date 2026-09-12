package com.carbonmarket.service;

import com.carbonmarket.common.BadRequestException;
import com.carbonmarket.common.ConflictException;
import com.carbonmarket.common.ForbiddenException;
import com.carbonmarket.common.GeoUtil;
import com.carbonmarket.common.NotFoundException;
import com.carbonmarket.config.CurrentUser;
import com.carbonmarket.domain.*;
import com.carbonmarket.dto.AgreementDtos.*;
import com.carbonmarket.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class NegotiationService {
    private final NegotiationRepository negotiations;
    private final ContractOfferRepository offers;
    private final AgreementRepository agreements;
    private final PassportRepository passports;
    private final CurrentUser current;
    private final Lookup lookup;
    private final TrustService trust;
    private final AuditService audit;
    private final NotificationService notifications;
    private final CostService costs;

    public NegotiationService(NegotiationRepository negotiations, ContractOfferRepository offers, AgreementRepository agreements,
                              PassportRepository passports, CurrentUser current, Lookup lookup, TrustService trust, AuditService audit,
                              NotificationService notifications, CostService costs) {
        this.negotiations = negotiations;
        this.offers = offers;
        this.agreements = agreements;
        this.passports = passports;
        this.current = current;
        this.lookup = lookup;
        this.trust = trust;
        this.audit = audit;
        this.notifications = notifications;
        this.costs = costs;
    }

    @Transactional
    public NegotiationDto create(NegotiationRequest r) {
        Company me = current.company();
        Company other = lookup.company(r.counterpartyCompanyId());
        Co2Passport p = lookup.passport(r.passportId());
        Company emitter, utilizer;
        if (me.getRole() == Role.EMITTER && other.getRole() == Role.UTILIZER) { emitter = me; utilizer = other; }
        else if (me.getRole() == Role.UTILIZER && other.getRole() == Role.EMITTER) { emitter = other; utilizer = me; }
        else throw new BadRequestException("A negotiation is between one EMITTER and one UTILIZER");
        if (!p.getEmitterId().equals(emitter.getId())) throw new BadRequestException("Passport does not belong to the emitter party");
        if (p.getVerificationStatus() != VerificationStatus.VERIFIED) throw new ConflictException("Passport must be VERIFIED before contracting");

        Negotiation n = new Negotiation();
        n.setPassportId(p.getId());
        n.setEmitterId(emitter.getId());
        n.setUtilizerId(utilizer.getId());
        n.setInitiatedByCompanyId(me.getId());
        negotiations.save(n);
        ContractOffer o = newOffer(n, 1, me.getId(), r.offer());
        offers.save(o);

        audit.record("NEGOTIATION_OPENED", "Negotiation", n.getId(), AuditService.details("passport", p.getPassportCode(),
                "counterparty", other.getId(), "pricePerTonne", o.getPricePerTonne(), "volumePerMonth", o.getVolumePerMonth(), "durationMonths", o.getDurationMonths()));
        notifications.notify(other.getId(), "NEGOTIATION_REQUEST", "Direct-connect: contract proposal from " + me.getName(),
                String.format("%s proposes a %d-month contract on %s: %.0f t/month at ₹%.0f/t (%s). Review and accept, reject or counter.",
                        me.getName(), o.getDurationMonths(), p.getPassportCode(), o.getVolumePerMonth(), o.getPricePerTonne(), o.getPricingStructure()),
                "Negotiation", n.getId());
        return dto(n);
    }

    @Transactional(readOnly = true)
    public List<NegotiationDto> list() {
        UUID me = current.companyId();
        List<Negotiation> l = current.isOversight() ? negotiations.findAllByOrderByCreatedAtDesc()
                : negotiations.findByEmitterIdOrUtilizerIdOrderByCreatedAtDesc(me, me);
        return l.stream().map(this::dto).toList();
    }

    @Transactional(readOnly = true)
    public NegotiationDto get(UUID id) {
        Negotiation n = find(id);
        assertParty(n);
        return dto(n);
    }

    @Transactional
    public NegotiationDto counter(UUID id, OfferRequest r) {
        Negotiation n = find(id);
        assertParty(n);
        if (n.getStatus() != NegotiationStatus.OPEN) throw new ConflictException("Negotiation is " + n.getStatus());
        List<ContractOffer> thread = offers.findByNegotiationIdOrderByVersionAsc(id);
        for (ContractOffer o : thread) if (o.getStatus() == OfferStatus.PENDING) { o.setStatus(OfferStatus.COUNTERED); offers.save(o); }
        ContractOffer o = newOffer(n, thread.size() + 1, current.companyId(), r);
        offers.save(o);
        UUID other = otherParty(n);
        audit.record("OFFER_COUNTERED", "Negotiation", id, AuditService.details("version", o.getVersion(), "pricePerTonne", o.getPricePerTonne(),
                "volumePerMonth", o.getVolumePerMonth(), "durationMonths", o.getDurationMonths()));
        notifications.notify(other, "NEGOTIATION_COUNTER", "Counter-offer v" + o.getVersion() + " received",
                String.format("%s countered: %.0f t/month × %d months at ₹%.0f/t.", lookup.companyName(current.companyId()),
                        o.getVolumePerMonth(), o.getDurationMonths(), o.getPricePerTonne()), "Negotiation", id);
        return dto(n);
    }

    @Transactional
    public NegotiationDto accept(UUID id, UUID offerId) {
        Negotiation n = find(id);
        assertParty(n);
        if (n.getStatus() != NegotiationStatus.OPEN) throw new ConflictException("Negotiation is " + n.getStatus());
        ContractOffer o = offers.findById(offerId).filter(x -> x.getNegotiationId().equals(id)).orElseThrow(() -> new NotFoundException("Offer not found"));
        if (o.getStatus() != OfferStatus.PENDING) throw new ConflictException("Offer is " + o.getStatus());
        if (o.getProposedByCompanyId().equals(current.companyId())) throw new ForbiddenException("You cannot accept your own offer");

        double total = o.getVolumePerMonth() * o.getDurationMonths();
        Co2Passport p = passports.findByIdForUpdate(n.getPassportId()).orElseThrow(() -> new NotFoundException("Passport not found"));
        if (total > p.freeTonnes() + 1e-9) {
            throw new ConflictException(String.format("Insufficient free volume: requested %.1f t, free %.1f t", total, p.freeTonnes()));
        }
        p.setAllocatedTonnes(p.getAllocatedTonnes() + total);
        p.setUpdatedAt(Instant.now());
        passports.save(p);

        Company utilizer = lookup.company(n.getUtilizerId());
        Agreement a = new Agreement();
        a.setNegotiationId(n.getId());
        a.setEmitterId(n.getEmitterId());
        a.setUtilizerId(n.getUtilizerId());
        a.setPassportId(p.getId());
        a.setMode(SaleMode.CONTRACT);
        a.setVolumeTonnes(total);
        a.setPricePerTonne(o.getPricePerTonne());
        a.setStatus(AgreementStatus.ACTIVE);
        a.setStartsAt(LocalDate.now().withDayOfMonth(1).plusMonths(1));
        a.setEndsAt(a.getStartsAt().plusMonths(o.getDurationMonths()));
        a.setDurationMonths(o.getDurationMonths());
        a.setVolumePerMonth(o.getVolumePerMonth());
        a.setDepositPct(o.getDepositPct());
        a.setTakeOrPay(o.isTakeOrPay());
        a.setSupplyGapThresholdPct(o.getSupplyGapThresholdPct());
        a.setPricingStructure(o.getPricingStructure());
        double dist = GeoUtil.distanceKm(p.getLatitude(), p.getLongitude(), utilizer.getLatitude(), utilizer.getLongitude());
        a.setCostStack(costs.calculateForPrice(o.getPricePerTonne(), p, o.getVolumePerMonth(), TransportMode.TRUCK, dist).toMap());
        agreements.save(a);

        o.setStatus(OfferStatus.ACCEPTED);
        offers.save(o);
        n.setStatus(NegotiationStatus.ACCEPTED);
        n.setAgreementId(a.getId());
        negotiations.save(n);
        trust.onAgreementCreated(a.getEmitterId(), a.getUtilizerId());

        audit.record("CONTRACT_SIGNED", "Agreement", a.getId(), AuditService.details("negotiation", id, "offerVersion", o.getVersion(),
                "lockedTonnes", total, "pricePerTonne", o.getPricePerTonne(), "depositPct", o.getDepositPct()));
        notifications.notify(o.getProposedByCompanyId(), "CONTRACT_SIGNED", "Contract accepted",
                String.format("%s accepted offer v%d: %.0f t/month × %d months at ₹%.0f/t. %.0f t locked on %s.%s",
                        lookup.companyName(current.companyId()), o.getVersion(), o.getVolumePerMonth(), o.getDurationMonths(), o.getPricePerTonne(),
                        total, p.getPassportCode(), o.getDepositPct() == null || o.getDepositPct() == 0 ? "" : " Deposit " + o.getDepositPct() + "% due at signing."),
                "Agreement", a.getId());
        return dto(n);
    }

    @Transactional
    public NegotiationDto reject(UUID id, UUID offerId) {
        Negotiation n = find(id);
        assertParty(n);
        if (n.getStatus() != NegotiationStatus.OPEN) throw new ConflictException("Negotiation is " + n.getStatus());
        ContractOffer o = offers.findById(offerId).filter(x -> x.getNegotiationId().equals(id)).orElseThrow(() -> new NotFoundException("Offer not found"));
        o.setStatus(OfferStatus.REJECTED);
        offers.save(o);
        n.setStatus(NegotiationStatus.REJECTED);
        negotiations.save(n);
        audit.record("NEGOTIATION_REJECTED", "Negotiation", id, AuditService.details("offerVersion", o.getVersion()));
        notifications.notify(otherParty(n), "NEGOTIATION_REJECTED", "Contract offer rejected",
                lookup.companyName(current.companyId()) + " rejected offer v" + o.getVersion() + ". The negotiation is closed.", "Negotiation", id);
        return dto(n);
    }

    /** Renewal: open a fresh negotiation pre-filled from an existing contract. */
    @Transactional
    public NegotiationDto renew(UUID agreementId) {
        Agreement a = lookup.agreement(agreementId);
        UUID me = current.companyId();
        if (!me.equals(a.getEmitterId()) && !me.equals(a.getUtilizerId())) throw new ForbiddenException("Not a party to this agreement");
        if (a.getMode() != SaleMode.CONTRACT) throw new BadRequestException("Only CONTRACT agreements can be renewed");
        UUID other = me.equals(a.getEmitterId()) ? a.getUtilizerId() : a.getEmitterId();
        OfferRequest offer = new OfferRequest(a.getPricePerTonne(), a.getVolumePerMonth() == null ? a.getVolumeTonnes() : a.getVolumePerMonth(),
                a.getDurationMonths() == null ? 12 : a.getDurationMonths(), a.getPricingStructure(), a.isTakeOrPay(),
                a.getSupplyGapThresholdPct(), a.getDepositPct(), "Renewal of agreement " + a.getId());
        return create(new NegotiationRequest(other, a.getPassportId(), offer));
    }

    // ---- helpers ----

    private ContractOffer newOffer(Negotiation n, int version, UUID by, OfferRequest r) {
        ContractOffer o = new ContractOffer();
        o.setNegotiationId(n.getId());
        o.setVersion(version);
        o.setProposedByCompanyId(by);
        o.setPricePerTonne(r.pricePerTonne());
        o.setVolumePerMonth(r.volumePerMonth());
        o.setDurationMonths(r.durationMonths());
        o.setPricingStructure(r.pricingStructure() == null ? PricingStructure.FIXED : r.pricingStructure());
        o.setTakeOrPay(Boolean.TRUE.equals(r.takeOrPay()));
        o.setSupplyGapThresholdPct(r.supplyGapThresholdPct() == null ? 10.0 : r.supplyGapThresholdPct());
        o.setDepositPct(r.depositPct() == null ? 10.0 : r.depositPct());
        o.setMessage(r.message());
        return o;
    }

    private Negotiation find(UUID id) {
        return negotiations.findById(id).orElseThrow(() -> new NotFoundException("Negotiation not found"));
    }

    private void assertParty(Negotiation n) {
        UUID me = current.companyId();
        if (current.isOversight() || me.equals(n.getEmitterId()) || me.equals(n.getUtilizerId())) return;
        throw new ForbiddenException("Not a party to this negotiation");
    }

    private UUID otherParty(Negotiation n) {
        return current.companyId().equals(n.getEmitterId()) ? n.getUtilizerId() : n.getEmitterId();
    }

    public NegotiationDto dto(Negotiation n) {
        List<ContractOfferDto> thread = offers.findByNegotiationIdOrderByVersionAsc(n.getId()).stream().map(o -> new ContractOfferDto(
                o.getId(), o.getVersion(), o.getProposedByCompanyId(), lookup.companyName(o.getProposedByCompanyId()), o.getPricePerTonne(),
                o.getVolumePerMonth(), o.getDurationMonths(), o.getPricingStructure(), o.isTakeOrPay(), o.getSupplyGapThresholdPct(),
                o.getDepositPct(), o.getMessage(), o.getStatus(), o.getVolumePerMonth() * o.getDurationMonths(),
                Math.round(o.getVolumePerMonth() * o.getDurationMonths() * o.getPricePerTonne() * 100.0) / 100.0, o.getCreatedAt())).toList();
        return new NegotiationDto(n.getId(), n.getPassportId(), lookup.passportCode(n.getPassportId()), n.getEmitterId(),
                lookup.companyName(n.getEmitterId()), n.getUtilizerId(), lookup.companyName(n.getUtilizerId()), n.getInitiatedByCompanyId(),
                n.getStatus(), n.getAgreementId(), thread, n.getCreatedAt());
    }
}
