package com.carbonmarket.service;

import com.carbonmarket.common.ConflictException;
import com.carbonmarket.common.ForbiddenException;
import com.carbonmarket.common.GeoUtil;
import com.carbonmarket.common.NotFoundException;
import com.carbonmarket.config.CurrentUser;
import com.carbonmarket.domain.*;
import com.carbonmarket.dto.ShipmentDtos.*;
import com.carbonmarket.repository.*;
import com.carbonmarket.scoring.Rates;
import com.carbonmarket.scoring.ReconciliationRules;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class ShipmentService {
    private final ShipmentRepository shipments;
    private final TransportOfferRepository offers;
    private final AgreementRepository agreements;
    private final CompanyRepository companies;
    private final CurrentUser current;
    private final Lookup lookup;
    private final AuditService audit;
    private final NotificationService notifications;

    public ShipmentService(ShipmentRepository shipments, TransportOfferRepository offers, AgreementRepository agreements,
                           CompanyRepository companies, CurrentUser current, Lookup lookup, AuditService audit,
                           NotificationService notifications) {
        this.shipments = shipments;
        this.offers = offers;
        this.agreements = agreements;
        this.companies = companies;
        this.current = current;
        this.lookup = lookup;
        this.audit = audit;
        this.notifications = notifications;
    }

    @Transactional
    public ShipmentDto create(UUID agreementId, ShipmentRequest r) {
        Agreement a = lookup.agreement(agreementId);
        UUID me = current.companyId();
        if (!me.equals(a.getEmitterId()) && !me.equals(a.getUtilizerId())) throw new ForbiddenException("Not a party to this agreement");
        if (a.getStatus() != AgreementStatus.ACTIVE) throw new ConflictException("Shipments require an ACTIVE agreement (lab approved)");
        double shipped = shipments.findByAgreementIdOrderByCreatedAtDesc(agreementId).stream()
                .filter(s -> s.getStatus() != ShipmentStatus.FLAGGED).mapToDouble(Shipment::getVolumeTonnes).sum();
        if (shipped + r.volumeTonnes() > a.getVolumeTonnes() + 1e-9) {
            throw new ConflictException(String.format("Shipment exceeds agreement: %.1f t already scheduled of %.1f t", shipped, a.getVolumeTonnes()));
        }
        Co2Passport p = lookup.passport(a.getPassportId());
        Company utilizer = lookup.company(a.getUtilizerId());
        boolean own = Boolean.TRUE.equals(r.ownTransport());
        double dist = GeoUtil.distanceKm(p.getLatitude(), p.getLongitude(), utilizer.getLatitude(), utilizer.getLongitude());
        if (r.transportMode() == TransportMode.PIPELINE && (!p.isPipelineConnected() || dist > Rates.PIPELINE_MAX_DISTANCE_KM)) {
            throw new ConflictException("PIPELINE_UNAVAILABLE for this route");
        }

        Shipment s = new Shipment();
        s.setAgreementId(agreementId);
        s.setOwnTransport(own);
        s.setTransportMode(r.transportMode());
        s.setStatus(own ? ShipmentStatus.ACCEPTED : ShipmentStatus.REQUESTED);
        s.setDistanceKm(dist);
        s.setVolumeTonnes(r.volumeTonnes());
        s.setOriginLat(p.getLatitude()); s.setOriginLng(p.getLongitude());
        s.setDestLat(utilizer.getLatitude()); s.setDestLng(utilizer.getLongitude());
        s.setLeakageTolerancePct(Rates.DEFAULT_LEAKAGE_TOLERANCE_PCT);
        s.setTransportCost(dist * r.volumeTonnes() * Rates.transportRatePerTonneKm(r.transportMode()) + Rates.transportFixedPerShipment(r.transportMode()));
        shipments.save(s);

        int notified = 0;
        if (!own) {
            List<Company> providers = companies.findByRoleAndStatus(Role.TRANSPORT, CompanyStatus.APPROVED);
            List<Company> inRange = providers.stream().filter(c ->
                    GeoUtil.distanceKm(p.getLatitude(), p.getLongitude(), c.getLatitude(), c.getLongitude()) <= Rates.TRANSPORT_NOTIFY_RADIUS_KM).toList();
            if (inRange.isEmpty()) { inRange = providers; s.getFlags().add("NO_PROVIDER_IN_RANGE"); shipments.save(s); }
            for (Company c : inRange) {
                TransportOffer o = new TransportOffer();
                o.setShipmentId(s.getId());
                o.setProviderId(c.getId());
                o.setDistanceFromOriginKm(GeoUtil.distanceKm(p.getLatitude(), p.getLongitude(), c.getLatitude(), c.getLongitude()));
                offers.save(o);
                notifications.notify(c.getId(), "TRANSPORT_REQUEST", "Shipment request near you",
                        String.format("%.0f t of %s CO2 by %s, %s → %s (%.0f km). Estimated ₹%.0f. Accept or reject.",
                                r.volumeTonnes(), p.getPhysicalState(), r.transportMode(), p.getLocationName(), utilizer.getCity(), dist, s.getTransportCost()),
                        "Shipment", s.getId());
                notified++;
            }
        }
        audit.record("SHIPMENT_REQUESTED", "Shipment", s.getId(), AuditService.details("agreement", agreementId, "volumeTonnes", r.volumeTonnes(),
                "mode", r.transportMode().name(), "ownTransport", own, "distanceKm", dist, "providersNotified", notified));
        return dto(s);
    }

    @Transactional(readOnly = true)
    public List<ShipmentDto> list() {
        UUID me = current.companyId();
        List<Shipment> l;
        if (current.isOversight()) l = shipments.findAllByOrderByCreatedAtDesc();
        else if (current.is(Role.TRANSPORT)) l = shipments.findByTransportProviderIdOrderByCreatedAtDesc(me);
        else {
            List<UUID> ids = agreements.findByEmitterIdOrUtilizerIdOrderByCreatedAtDesc(me, me).stream().map(Agreement::getId).toList();
            l = ids.isEmpty() ? List.of() : shipments.findByAgreementIdInOrderByCreatedAtDesc(ids);
        }
        return l.stream().map(this::dto).toList();
    }

    @Transactional(readOnly = true)
    public ShipmentDto get(UUID id) {
        Shipment s = find(id);
        assertCanView(s);
        return dto(s);
    }

    @Transactional(readOnly = true)
    public List<TransportOfferDto> myOffers() {
        return offers.findByProviderIdOrderByCreatedAtDesc(current.companyId()).stream()
                .map(o -> new TransportOfferDto(o.getId(), o.getShipmentId(), dto(find(o.getShipmentId())), o.getStatus(),
                        o.getDistanceFromOriginKm(), o.getQuotedPrice(), o.getCreatedAt())).toList();
    }

    @Transactional
    public TransportOfferDto acceptOffer(UUID offerId, Double quotedPrice) {
        TransportOffer o = offers.findById(offerId).filter(x -> x.getProviderId().equals(current.companyId()))
                .orElseThrow(() -> new NotFoundException("Offer not found"));
        if (o.getStatus() != TransportOfferStatus.NOTIFIED) throw new ConflictException("Offer is " + o.getStatus());
        Shipment s = find(o.getShipmentId());
        if (s.getStatus() != ShipmentStatus.REQUESTED) throw new ConflictException("Shipment already assigned"); // first accept wins
        o.setStatus(TransportOfferStatus.ACCEPTED);
        o.setQuotedPrice(quotedPrice);
        offers.save(o);
        for (TransportOffer sib : offers.findByShipmentIdAndStatus(s.getId(), TransportOfferStatus.NOTIFIED)) {
            sib.setStatus(TransportOfferStatus.EXPIRED);
            offers.save(sib);
        }
        s.setTransportProviderId(o.getProviderId());
        s.setStatus(ShipmentStatus.ACCEPTED);
        if (quotedPrice != null) s.setTransportCost(quotedPrice);
        shipments.save(s);
        Agreement a = lookup.agreement(s.getAgreementId());
        String msg = lookup.companyName(o.getProviderId()) + " accepted the shipment of " + s.getVolumeTonnes() + " t"
                + (quotedPrice == null ? "." : " at ₹" + Math.round(quotedPrice) + ".");
        notifications.notify(a.getEmitterId(), "TRANSPORT_ACCEPTED", "Transport provider assigned", msg, "Shipment", s.getId());
        notifications.notify(a.getUtilizerId(), "TRANSPORT_ACCEPTED", "Transport provider assigned", msg, "Shipment", s.getId());
        audit.record("TRANSPORT_ACCEPTED", "Shipment", s.getId(), AuditService.details("provider", o.getProviderId(), "quotedPrice", quotedPrice));
        return new TransportOfferDto(o.getId(), o.getShipmentId(), dto(s), o.getStatus(), o.getDistanceFromOriginKm(), o.getQuotedPrice(), o.getCreatedAt());
    }

    @Transactional
    public TransportOfferDto rejectOffer(UUID offerId) {
        TransportOffer o = offers.findById(offerId).filter(x -> x.getProviderId().equals(current.companyId()))
                .orElseThrow(() -> new NotFoundException("Offer not found"));
        if (o.getStatus() != TransportOfferStatus.NOTIFIED) throw new ConflictException("Offer is " + o.getStatus());
        o.setStatus(TransportOfferStatus.REJECTED);
        offers.save(o);
        audit.record("TRANSPORT_REJECTED", "Shipment", o.getShipmentId(), AuditService.details("provider", o.getProviderId()));
        return new TransportOfferDto(o.getId(), o.getShipmentId(), dto(find(o.getShipmentId())), o.getStatus(), o.getDistanceFromOriginKm(), o.getQuotedPrice(), o.getCreatedAt());
    }

    @Transactional
    public ShipmentDto load(UUID id, LoadRequest r) {
        Shipment s = find(id);
        Agreement a = lookup.agreement(s.getAgreementId());
        UUID me = current.companyId();
        if (!me.equals(a.getEmitterId()) && !me.equals(s.getTransportProviderId())) throw new ForbiddenException("Only the emitter or assigned transport can record loading");
        if (s.getStatus() != ShipmentStatus.ACCEPTED) throw new ConflictException("Shipment must be ACCEPTED (transport assigned) before loading");
        s.setSealNumber(r.sealNumber());
        s.setLoadedWeightTonnes(r.loadedWeightTonnes());
        s.setLoadMeterReading(r.meterReading());
        s.setLoadSamplePurityPct(r.samplePurityPct());
        s.setLoadedAt(Instant.now());
        s.setStatus(ShipmentStatus.IN_TRANSIT);
        shipments.save(s);
        audit.record("SHIPMENT_LOADED", "Shipment", id, AuditService.details("seal", r.sealNumber(), "loadedWeightTonnes", r.loadedWeightTonnes(),
                "meterReading", r.meterReading(), "samplePurityPct", r.samplePurityPct()));
        notifications.notify(a.getUtilizerId(), "SHIPMENT_IN_TRANSIT", "Shipment loaded and sealed",
                String.format("%.1f t loaded under seal %s (sample purity %s%%). Verify seal and re-sample on delivery.",
                        r.loadedWeightTonnes(), r.sealNumber(), r.samplePurityPct() == null ? "n/a" : r.samplePurityPct()), "Shipment", id);
        return dto(s);
    }

    @Transactional
    public ShipmentDto deliver(UUID id, DeliverRequest r) {
        Shipment s = find(id);
        Agreement a = lookup.agreement(s.getAgreementId());
        UUID me = current.companyId();
        if (!me.equals(a.getUtilizerId()) && !me.equals(s.getTransportProviderId())) throw new ForbiddenException("Only the utilizer or assigned transport can record delivery");
        if (s.getStatus() != ShipmentStatus.IN_TRANSIT) throw new ConflictException("Shipment must be IN_TRANSIT before delivery");
        s.setDeliverySealNumber(r.sealNumber());
        s.setDeliveredWeightTonnes(r.deliveredWeightTonnes());
        s.setDeliveryMeterReading(r.meterReading());
        s.setDeliverySamplePurityPct(r.samplePurityPct());
        s.setDeliveredAt(Instant.now());
        List<String> flags = ReconciliationRules.evaluate(new ReconciliationRules.Input(s.getSealNumber(), r.sealNumber(),
                s.getLoadedWeightTonnes(), r.deliveredWeightTonnes(), s.getLoadSamplePurityPct(), r.samplePurityPct(),
                s.getLoadMeterReading(), r.meterReading(), s.getLeakageTolerancePct()));
        List<String> all = new ArrayList<>(s.getFlags());
        all.addAll(flags);
        s.setFlags(all);
        s.setStatus(flags.isEmpty() ? ShipmentStatus.DELIVERED : ShipmentStatus.FLAGGED);
        shipments.save(s);
        audit.record(flags.isEmpty() ? "SHIPMENT_DELIVERED" : "SHIPMENT_FLAGGED", "Shipment", id, AuditService.details("deliverySeal", r.sealNumber(),
                "deliveredWeightTonnes", r.deliveredWeightTonnes(), "flags", flags));
        if (!flags.isEmpty()) {
            String msg = "Reconciliation flags on shipment of " + lookup.passportCode(a.getPassportId()) + ": " + String.join(", ", flags)
                    + String.format(" (loaded %.2f t / delivered %.2f t).", s.getLoadedWeightTonnes(), r.deliveredWeightTonnes());
            notifications.notify(a.getEmitterId(), "SHIPMENT_FLAGGED", "Shipment flagged", msg, "Shipment", id);
            notifications.notify(a.getUtilizerId(), "SHIPMENT_FLAGGED", "Shipment flagged", msg, "Shipment", id);
            for (Company lab : companies.findByRoleAndStatus(Role.LAB, CompanyStatus.APPROVED))
                notifications.notify(lab.getId(), "SHIPMENT_FLAGGED", "Shipment flagged for review", msg, "Shipment", id);
        } else {
            notifications.notify(a.getEmitterId(), "SHIPMENT_DELIVERED", "Shipment delivered and reconciled",
                    String.format("%.2f t delivered; seal, weight, purity and meter readings all within tolerance.", r.deliveredWeightTonnes()), "Shipment", id);
        }
        return dto(s);
    }

    // ---- helpers ----

    private Shipment find(UUID id) { return shipments.findById(id).orElseThrow(() -> new NotFoundException("Shipment not found")); }

    private void assertCanView(Shipment s) {
        UUID me = current.companyId();
        if (current.isOversight() || me.equals(s.getTransportProviderId())) return;
        Agreement a = lookup.agreement(s.getAgreementId());
        if (me.equals(a.getEmitterId()) || me.equals(a.getUtilizerId())) return;
        if (current.is(Role.TRANSPORT) && offers.findByShipmentId(s.getId()).stream().anyMatch(o -> o.getProviderId().equals(me))) return;
        throw new ForbiddenException("Not involved in this shipment");
    }

    public ShipmentDto dto(Shipment s) {
        Agreement a = lookup.agreement(s.getAgreementId());
        return new ShipmentDto(s.getId(), s.getAgreementId(), lookup.passportCode(a.getPassportId()), lookup.companyName(a.getEmitterId()),
                lookup.companyName(a.getUtilizerId()), s.getTransportProviderId(), lookup.companyName(s.getTransportProviderId()),
                s.isOwnTransport(), s.getTransportMode(), s.getStatus(), s.getDistanceKm(), s.getVolumeTonnes(), s.getSealNumber(),
                s.getLoadedWeightTonnes(), s.getLoadMeterReading(), s.getLoadSamplePurityPct(), s.getLoadedAt(), s.getDeliverySealNumber(),
                s.getDeliveredWeightTonnes(), s.getDeliveryMeterReading(), s.getDeliverySamplePurityPct(), s.getDeliveredAt(),
                s.getLeakageTolerancePct(), s.getFlags(), s.getTransportCost(), s.getCreatedAt());
    }
}
