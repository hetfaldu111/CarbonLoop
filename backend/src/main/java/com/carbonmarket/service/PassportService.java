package com.carbonmarket.service;

import com.carbonmarket.common.BadRequestException;
import com.carbonmarket.common.ConflictException;
import com.carbonmarket.common.ForbiddenException;
import com.carbonmarket.common.GeoUtil;
import com.carbonmarket.config.CurrentUser;
import com.carbonmarket.domain.*;
import com.carbonmarket.dto.PassportDtos.*;
import com.carbonmarket.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.util.*;

@Service
public class PassportService {
    private final PassportRepository passports;
    private final ListingRepository listings;
    private final AgreementRepository agreements;
    private final OutputForecastRepository forecasts;
    private final VerificationRequestRepository verifications;
    private final CompanyRepository companies;
    private final CurrentUser current;
    private final Lookup lookup;
    private final AuditService audit;
    private final NotificationService notifications;

    public PassportService(PassportRepository passports, ListingRepository listings, AgreementRepository agreements,
                           OutputForecastRepository forecasts, VerificationRequestRepository verifications,
                           CompanyRepository companies, CurrentUser current, Lookup lookup, AuditService audit,
                           NotificationService notifications) {
        this.passports = passports;
        this.listings = listings;
        this.agreements = agreements;
        this.forecasts = forecasts;
        this.verifications = verifications;
        this.companies = companies;
        this.current = current;
        this.lookup = lookup;
        this.audit = audit;
        this.notifications = notifications;
    }

    @Transactional(readOnly = true)
    public List<PassportDto> mine() {
        return passports.findByEmitterIdOrderByCreatedAtDesc(current.companyId()).stream().map(this::dto).toList();
    }

    @Transactional(readOnly = true)
    public PassportDto get(UUID id) {
        Co2Passport p = lookup.passport(id);
        if (!p.getEmitterId().equals(current.companyId()) && !current.isOversight()) throw new ForbiddenException("Not your passport");
        return dto(p);
    }

    @Transactional(readOnly = true)
    public PassportPublicDto getPublic(UUID id) {
        Co2Passport p = lookup.passport(id);
        Company e = lookup.company(p.getEmitterId());
        return new PassportPublicDto(p.getId(), p.getPassportCode(), p.getSource(), p.getCarbonOrigin(), p.getCaptureTechnology(),
                p.getDailyTonnage(), p.getConcentrationPct(), p.getPhysicalState(), p.getPressureBar(), p.getTemperatureC(),
                p.getImpurities(), p.getLabCertificateStatus(), lookup.companyName(p.getIssuingLabId()), p.getCoaIssuedAt(),
                p.getCoaExpiresAt(), p.getLocationName(), e.getCity(), e.getState(), p.getLatitude(), p.getLongitude(),
                p.getAvailabilityStart(), p.getAvailabilityEnd(), p.isPipelineConnected(), p.getVerificationStatus(),
                p.getMrvStatus(), p.getExtraAttributes());
    }

    @Transactional
    public PassportDto create(PassportRequest r) {
        Company emitter = current.company();
        Co2Passport p = new Co2Passport();
        p.setEmitterId(emitter.getId());
        p.setPassportCode(nextCode());
        apply(p, r, emitter);
        p.setVerificationStatus(VerificationStatus.PENDING);
        p.setLabCertificateStatus(LabCertificateStatus.PENDING);
        passports.save(p);

        VerificationRequest vr = new VerificationRequest();
        vr.setType(VerificationType.PASSPORT_COA);
        vr.setPassportId(p.getId());
        vr.setPriority(3);
        vr.setClaimedSpecs(claimedSpecs(p));
        verifications.save(vr);

        audit.record("PASSPORT_CREATED", "Passport", p.getId(), AuditService.details("code", p.getPassportCode(),
                "totalVolumeTonnes", p.getTotalVolumeTonnes(), "concentrationPct", p.getConcentrationPct()));
        for (Company lab : companies.findByRoleAndStatus(Role.LAB, CompanyStatus.APPROVED)) {
            notifications.notify(lab.getId(), "VERIFICATION_QUEUED", "New passport awaiting COA",
                    p.getPassportCode() + " from " + emitter.getName() + " needs an independent Certificate of Analysis.",
                    "VerificationRequest", vr.getId());
        }
        return dto(p);
    }

    @Transactional
    public PassportDto update(UUID id, PassportRequest r) {
        Co2Passport p = passports.findByIdForUpdate(id).orElseThrow(() -> new com.carbonmarket.common.NotFoundException("Passport not found"));
        if (!p.getEmitterId().equals(current.companyId())) throw new ForbiddenException("Not your passport");
        if (r.totalVolumeTonnes() < p.getAllocatedTonnes()) {
            throw new ConflictException("Total volume cannot be below allocated volume (" + p.getAllocatedTonnes() + " t)");
        }
        boolean specChanged = !Objects.equals(r.concentrationPct(), p.getConcentrationPct())
                || !Objects.equals(r.impurities(), p.getImpurities());
        apply(p, r, current.company());
        if (specChanged && p.getVerificationStatus() == VerificationStatus.VERIFIED) {
            // Spec change invalidates the COA: back to the lab queue.
            p.setVerificationStatus(VerificationStatus.PENDING);
            p.setLabCertificateStatus(LabCertificateStatus.PENDING);
            VerificationRequest vr = new VerificationRequest();
            vr.setType(VerificationType.PASSPORT_COA);
            vr.setPassportId(p.getId());
            vr.setPriority(4);
            vr.setClaimedSpecs(claimedSpecs(p));
            vr.setNotes("Re-verification after spec change");
            verifications.save(vr);
        }
        p.setUpdatedAt(Instant.now());
        passports.save(p);
        audit.record("PASSPORT_UPDATED", "Passport", p.getId(), AuditService.details("code", p.getPassportCode(), "specChanged", specChanged));
        return dto(p);
    }

    @Transactional(readOnly = true)
    public AllocationDto allocation(UUID id) {
        Co2Passport p = lookup.passport(id);
        if (!p.getEmitterId().equals(current.companyId()) && !current.isOversight()) throw new ForbiddenException("Not your passport");
        double tender = 0, auction = 0, contract = 0;
        List<AllocationLine> ls = new ArrayList<>();
        for (Listing l : listings.findByPassportId(id)) {
            if (l.getStatus() != ListingStatus.OPEN) continue;
            ls.add(new AllocationLine(l.getId(), l.getMode(), l.getStatus().name(), l.getVolumeTonnes(), null));
            if (l.getMode() == SaleMode.TENDER) tender += l.getVolumeTonnes();
            else if (l.getMode() == SaleMode.AUCTION) auction += l.getVolumeTonnes();
        }
        List<AllocationLine> as = new ArrayList<>();
        for (Agreement a : agreements.findByPassportId(id)) {
            if (a.getStatus() != AgreementStatus.ACTIVE && a.getStatus() != AgreementStatus.PENDING_VERIFICATION) continue;
            as.add(new AllocationLine(a.getId(), a.getMode(), a.getStatus().name(), a.getVolumeTonnes(), lookup.companyName(a.getUtilizerId())));
            switch (a.getMode()) {
                case TENDER -> tender += a.getVolumeTonnes();
                case AUCTION -> auction += a.getVolumeTonnes();
                case CONTRACT -> contract += a.getVolumeTonnes();
            }
        }
        return new AllocationDto(p.getId(), p.getPassportCode(), p.getTotalVolumeTonnes(), p.getAllocatedTonnes(),
                tender, auction, contract, p.freeTonnes(), ls, as);
    }

    // ---- Forecasts / shortfall ----

    @Transactional(readOnly = true)
    public List<ForecastDto> forecasts(UUID passportId) {
        Co2Passport p = lookup.passport(passportId);
        return forecasts.findByPassportIdOrderByPeriodStartAsc(passportId).stream().map(f -> forecastDto(f, p, -1)).toList();
    }

    @Transactional
    public ForecastDto addForecast(UUID passportId, ForecastRequest r) {
        Co2Passport p = lookup.passport(passportId);
        if (!p.getEmitterId().equals(current.companyId())) throw new ForbiddenException("Not your passport");
        if (r.periodEnd().isBefore(r.periodStart())) throw new BadRequestException("periodEnd must be after periodStart");
        OutputForecast f = new OutputForecast();
        f.setPassportId(passportId);
        f.setPeriodStart(r.periodStart());
        f.setPeriodEnd(r.periodEnd());
        f.setExpectedTonnesPerDay(r.expectedTonnesPerDay());
        f.setReason(r.reason());
        forecasts.save(f);
        int notified = notifyShortfall(f, p);
        audit.record("FORECAST_ADDED", "Passport", passportId, AuditService.details("expectedTonnesPerDay", r.expectedTonnesPerDay(),
                "periodStart", r.periodStart().toString(), "periodEnd", r.periodEnd().toString(), "utilizersNotified", notified));
        return forecastDto(f, p, notified);
    }

    /** Notifies every utilizer with an active agreement on the passport overlapping the period, with alternatives. */
    @Transactional
    public int notifyShortfall(OutputForecast f, Co2Passport p) {
        double baseline = p.getDailyTonnage() == null ? 0 : p.getDailyTonnage();
        if (baseline <= 0 || f.getExpectedTonnesPerDay() >= baseline) return 0;
        double shortfallPct = (baseline - f.getExpectedTonnesPerDay()) / baseline * 100.0;
        int count = 0;
        for (Agreement a : agreements.findByPassportIdAndStatus(p.getId(), AgreementStatus.ACTIVE)) {
            if (a.getEndsAt() != null && a.getEndsAt().isBefore(f.getPeriodStart())) continue;
            if (a.getStartsAt() != null && a.getStartsAt().isAfter(f.getPeriodEnd())) continue;
            Company u = lookup.company(a.getUtilizerId());
            String alternatives = alternatives(p, u, 3);
            notifications.notify(u.getId(), "FORECAST_SHORTFALL", "Forecast supply shortfall on " + p.getPassportCode(),
                    String.format("%s expects output to drop to %.1f t/day (%.0f%% below the usual %.1f t/day) from %s to %s%s. %s",
                            lookup.companyName(p.getEmitterId()), f.getExpectedTonnesPerDay(), shortfallPct, baseline,
                            f.getPeriodStart(), f.getPeriodEnd(), f.getReason() == null ? "" : " (" + f.getReason() + ")", alternatives),
                    "Agreement", a.getId());
            count++;
        }
        notifications.notify(p.getEmitterId(), "FORECAST_RECORDED", "Shortfall forecast recorded",
                String.format("%.0f%% shortfall on %s from %s to %s; %d utilizer(s) notified with backup options.",
                        shortfallPct, p.getPassportCode(), f.getPeriodStart(), f.getPeriodEnd(), count), "Passport", p.getId());
        return count;
    }

    /** Backup supplier suggestion: reuse listing discovery — OPEN listings from other emitters, purity-compatible, ranked by price then distance. */
    private String alternatives(Co2Passport p, Company utilizer, int limit) {
        double needPurity = p.getConcentrationPct() == null ? 0 : p.getConcentrationPct() - 2;
        record Alt(Listing l, Co2Passport lp, Company e, double dist) {}
        List<Alt> alts = new ArrayList<>();
        for (Listing l : listings.findByStatusOrderByCreatedAtDesc(ListingStatus.OPEN)) {
            if (l.getEmitterId().equals(p.getEmitterId())) continue;
            Co2Passport lp = lookup.passport(l.getPassportId());
            if (lp.getConcentrationPct() != null && lp.getConcentrationPct() < needPurity) continue;
            Company e = lookup.company(l.getEmitterId());
            alts.add(new Alt(l, lp, e, GeoUtil.distanceKm(lp.getLatitude(), lp.getLongitude(), utilizer.getLatitude(), utilizer.getLongitude())));
        }
        alts.sort(Comparator.comparingDouble((Alt a) -> a.l().getBasePricePerTonne()).thenComparingDouble(Alt::dist));
        if (alts.isEmpty()) return "No alternative open listings right now.";
        StringBuilder sb = new StringBuilder("Alternatives: ");
        for (int i = 0; i < Math.min(limit, alts.size()); i++) {
            Alt a = alts.get(i);
            if (i > 0) sb.append("; ");
            sb.append(String.format("%s/%s %.0f t @ ₹%.0f/t (%s, %.0f km, listing %s)", a.e().getCity(), a.e().getState(),
                    a.l().getVolumeTonnes(), a.l().getBasePricePerTonne(), a.l().getMode(), a.dist(), a.l().getId()));
        }
        return sb.toString();
    }

    private ForecastDto forecastDto(OutputForecast f, Co2Passport p, int notified) {
        Double baseline = p.getDailyTonnage();
        Double shortfall = baseline == null || baseline <= 0 ? null : Math.round((baseline - f.getExpectedTonnesPerDay()) / baseline * 1000.0) / 10.0;
        return new ForecastDto(f.getId(), f.getPassportId(), f.getPeriodStart(), f.getPeriodEnd(), f.getExpectedTonnesPerDay(),
                baseline, shortfall, f.getReason(), f.getCreatedAt(), notified);
    }

    // ---- helpers ----

    public PassportDto dto(Co2Passport p) {
        return PassportDto.from(p, lookup.companyName(p.getEmitterId()), lookup.companyName(p.getIssuingLabId()));
    }

    public static Map<String, Object> claimedSpecs(Co2Passport p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("concentrationPct", p.getConcentrationPct());
        m.put("impurities", p.getImpurities());
        m.put("physicalState", p.getPhysicalState() == null ? null : p.getPhysicalState().name());
        m.put("pressureBar", p.getPressureBar());
        m.put("temperatureC", p.getTemperatureC());
        m.put("dailyTonnage", p.getDailyTonnage());
        m.put("meterId", p.getMeterId());
        return m;
    }

    private void apply(Co2Passport p, PassportRequest r, Company emitter) {
        p.setSource(r.source());
        p.setCarbonOrigin(r.carbonOrigin());
        p.setCaptureTechnology(r.captureTechnology());
        p.setDailyTonnage(r.dailyTonnage());
        p.setDailyTonnageMin(r.dailyTonnageMin());
        p.setDailyTonnageMax(r.dailyTonnageMax());
        p.setTotalVolumeTonnes(r.totalVolumeTonnes());
        p.setConcentrationPct(r.concentrationPct());
        p.setPhysicalState(r.physicalState());
        p.setPressureBar(r.pressureBar());
        p.setTemperatureC(r.temperatureC());
        p.setImpurities(r.impurities() == null ? new LinkedHashMap<>() : r.impurities());
        p.setCaptureTimestamp(r.captureTimestamp() == null ? Instant.now() : r.captureTimestamp());
        p.setMeterId(r.meterId());
        p.setLocationName(r.locationName() == null ? emitter.getCity() : r.locationName());
        p.setLatitude(r.latitude() == null ? emitter.getLatitude() : r.latitude());
        p.setLongitude(r.longitude() == null ? emitter.getLongitude() : r.longitude());
        p.setAvailabilityStart(r.availabilityStart() == null ? LocalDate.now() : r.availabilityStart());
        p.setAvailabilityEnd(r.availabilityEnd() == null ? LocalDate.now().plusMonths(12) : r.availabilityEnd());
        p.setPipelineConnected(Boolean.TRUE.equals(r.pipelineConnected()));
        p.setCertifications(r.certifications() == null ? new ArrayList<>() : r.certifications());
        p.setExtraAttributes(r.extraAttributes() == null ? new LinkedHashMap<>() : r.extraAttributes());
    }

    private String nextCode() {
        String prefix = "CO2-IND-" + Year.now().getValue() + "-";
        int next = 346;
        Optional<String> max = passports.findMaxPassportCode();
        if (max.isPresent()) {
            String s = max.get();
            try { next = Integer.parseInt(s.substring(s.lastIndexOf('-') + 1)) + 1; } catch (Exception ignored) {}
        }
        return prefix + String.format("%06d", next);
    }
}
