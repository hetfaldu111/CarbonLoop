package com.carbonmarket.service;

import com.carbonmarket.common.BadRequestException;
import com.carbonmarket.common.ConflictException;
import com.carbonmarket.common.ForbiddenException;
import com.carbonmarket.common.GeoUtil;
import com.carbonmarket.common.NotFoundException;
import com.carbonmarket.config.CurrentUser;
import com.carbonmarket.domain.*;
import com.carbonmarket.dto.AgreementDtos.AgreementDto;
import com.carbonmarket.dto.ListingDtos.*;
import com.carbonmarket.repository.*;
import com.carbonmarket.scoring.PriorityScoring;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class ListingService {
    private final ListingRepository listings;
    private final PassportRepository passports;
    private final ProposalRepository proposals;
    private final TrustProfileRepository trustProfiles;
    private final CurrentUser current;
    private final Lookup lookup;
    private final AuditService audit;
    private final NotificationService notifications;
    private final AgreementService agreementService;
    private final TrustService trustService;

    public ListingService(ListingRepository listings, PassportRepository passports, ProposalRepository proposals,
                          TrustProfileRepository trustProfiles, CurrentUser current, Lookup lookup, AuditService audit,
                          NotificationService notifications, AgreementService agreementService, TrustService trustService) {
        this.listings = listings;
        this.passports = passports;
        this.proposals = proposals;
        this.trustProfiles = trustProfiles;
        this.current = current;
        this.lookup = lookup;
        this.audit = audit;
        this.notifications = notifications;
        this.agreementService = agreementService;
        this.trustService = trustService;
    }

    // ---- Listings ----

    @Transactional
    public ListingDto create(ListingRequest r) {
        Co2Passport p = passports.findByIdForUpdate(r.passportId()).orElseThrow(() -> new NotFoundException("Passport not found"));
        if (!p.getEmitterId().equals(current.companyId())) throw new ForbiddenException("Not your passport");
        if (p.getVerificationStatus() != VerificationStatus.VERIFIED) {
            throw new ConflictException("Passport " + p.getPassportCode() + " is not VERIFIED (" + p.getVerificationStatus() + "); an independent lab COA is required before listing");
        }
        if (p.getLabCertificateStatus() == LabCertificateStatus.EXPIRED) {
            throw new ConflictException("Passport " + p.getPassportCode() + " COA has expired; re-testing required before listing");
        }
        if (r.mode() == SaleMode.CONTRACT) throw new BadRequestException("Contracts are created through negotiations, not listings");
        if (r.volumeTonnes() > p.freeTonnes() + 1e-9) {
            throw new ConflictException(String.format("Insufficient free volume: requested %.1f t, free %.1f t", r.volumeTonnes(), p.freeTonnes()));
        }
        p.setAllocatedTonnes(p.getAllocatedTonnes() + r.volumeTonnes());
        p.setUpdatedAt(Instant.now());
        passports.save(p);

        Listing l = new Listing();
        l.setPassportId(p.getId());
        l.setEmitterId(p.getEmitterId());
        l.setMode(r.mode());
        l.setVolumeTonnes(r.volumeTonnes());
        l.setBasePricePerTonne(r.basePricePerTonne());
        l.setMinPurityPct(r.minPurityPct());
        l.setDeliveryWindowStart(r.deliveryWindowStart());
        l.setDeliveryWindowEnd(r.deliveryWindowEnd());
        l.setClosesAt(r.closesAt());
        l.setDescription(r.description());
        l.setReservePricePerTonne(r.mode() == SaleMode.AUCTION ? r.reservePricePerTonne() : null);
        listings.save(l);
        audit.record("LISTING_CREATED", "Listing", l.getId(), AuditService.details("passport", p.getPassportCode(), "mode", r.mode().name(),
                "volumeTonnes", r.volumeTonnes(), "basePricePerTonne", r.basePricePerTonne(), "lockedTonnes", r.volumeTonnes()));
        return dto(l, true);
    }

    @Transactional(readOnly = true)
    public List<ListingDto> discover(SaleMode mode, ListingStatus status, Double minPurity, String state) {
        ListingStatus st = status == null ? ListingStatus.OPEN : status;
        List<ListingDto> out = new ArrayList<>();
        for (Listing l : listings.findByStatusOrderByCreatedAtDesc(st)) {
            if (mode != null && l.getMode() != mode) continue;
            ListingDto d = dto(l, canSeeIdentity(l));
            if (minPurity != null && (d.concentrationPct() == null || d.concentrationPct() < minPurity)) continue;
            if (state != null && !state.isBlank() && (d.state() == null || !d.state().equalsIgnoreCase(state))) continue;
            out.add(d);
        }
        return out;
    }

    @Transactional(readOnly = true)
    public List<ListingDto> mine() {
        return listings.findByEmitterIdOrderByCreatedAtDesc(current.companyId()).stream().map(l -> dto(l, true)).toList();
    }

    @Transactional(readOnly = true)
    public ListingDto get(UUID id) {
        Listing l = lookup.listing(id);
        return dto(l, canSeeIdentity(l));
    }

    @Transactional
    public ListingDto cancel(UUID id) {
        Listing l = lookup.listing(id);
        if (!l.getEmitterId().equals(current.companyId())) throw new ForbiddenException("Not your listing");
        if (l.getStatus() != ListingStatus.OPEN) throw new ConflictException("Only OPEN listings can be cancelled");
        Co2Passport p = passports.findByIdForUpdate(l.getPassportId()).orElseThrow(() -> new NotFoundException("Passport not found"));
        p.setAllocatedTonnes(Math.max(0, p.getAllocatedTonnes() - l.getVolumeTonnes()));
        passports.save(p);
        l.setStatus(ListingStatus.CANCELLED);
        listings.save(l);
        for (Proposal pr : proposals.findByListingIdOrderByScoreDescCreatedAtAsc(id)) {
            if (pr.getStatus() == ProposalStatus.SUBMITTED) {
                pr.setStatus(ProposalStatus.REJECTED);
                proposals.save(pr);
                notifications.notify(pr.getUtilizerId(), "LISTING_CANCELLED", "Listing cancelled",
                        "The " + l.getMode() + " listing on " + p.getPassportCode() + " you responded to was cancelled by the emitter.", "Listing", id);
            }
        }
        audit.record("LISTING_CANCELLED", "Listing", id, AuditService.details("releasedTonnes", l.getVolumeTonnes()));
        return dto(l, true);
    }

    // ---- Proposals / bids ----

    @Transactional
    public ProposalDto submitProposal(UUID listingId, ProposalRequest r) {
        Listing l = lookup.listing(listingId);
        if (l.getStatus() != ListingStatus.OPEN) throw new ConflictException("Listing is not open");
        if (l.getClosesAt() != null && l.getClosesAt().isBefore(Instant.now())) throw new ConflictException("Listing has closed");
        UUID me = current.companyId();
        if (proposals.findByListingIdAndUtilizerIdAndStatus(listingId, me, ProposalStatus.SUBMITTED).isPresent()) {
            throw new ConflictException("You already have an active proposal on this listing; withdraw it first");
        }
        if (r.quantityTonnes() > l.getVolumeTonnes() + 1e-9) {
            throw new BadRequestException(String.format("Requested %.1f t exceeds listed %.1f t", r.quantityTonnes(), l.getVolumeTonnes()));
        }
        if (l.getMode() == SaleMode.AUCTION && l.getReservePricePerTonne() != null && r.offeredPricePerTonne() < l.getReservePricePerTonne()) {
            throw new BadRequestException("Bid is below the reserve price of ₹" + l.getReservePricePerTonne() + "/t");
        }
        Co2Passport p = lookup.passport(l.getPassportId());
        Company utilizer = current.company();
        TrustProfile t = trustService.getOrCreate(me);

        Proposal pr = new Proposal();
        pr.setListingId(listingId);
        pr.setUtilizerId(me);
        pr.setQuantityTonnes(r.quantityTonnes());
        pr.setRequiredPurityPct(r.requiredPurityPct());
        pr.setDurationMonths(r.durationMonths() == null ? 0 : r.durationMonths());
        pr.setDeliveryRequirement(r.deliveryRequirement());
        pr.setOfferedPricePerTonne(r.offeredPricePerTonne());
        pr.setAcceptsEscrow(Boolean.TRUE.equals(r.acceptsEscrow()));
        pr.setOtherRequirements(r.otherRequirements());
        score(pr, l, p, utilizer, t);
        proposals.save(pr);

        audit.record("PROPOSAL_SUBMITTED", "Proposal", pr.getId(), AuditService.details("listing", listingId, "mode", l.getMode().name(),
                "quantityTonnes", r.quantityTonnes(), "offeredPricePerTonne", r.offeredPricePerTonne(), "score", pr.getScore()));
        notifications.notify(l.getEmitterId(), l.getMode() == SaleMode.AUCTION ? "BID_RECEIVED" : "PROPOSAL_RECEIVED",
                (l.getMode() == SaleMode.AUCTION ? "New bid" : "New tender proposal") + " on " + p.getPassportCode(),
                String.format("%s (%s) offers ₹%.0f/t for %.0f t. Priority score %.1f.", utilizer.getName(), t.getTier(),
                        r.offeredPricePerTonne(), r.quantityTonnes(), pr.getScore()), "Listing", listingId);
        return proposalDto(pr, l, null, null);
    }

    /** Scores (or re-scores) a proposal using the deterministic formula. Public so the seeder reuses it. */
    public void score(Proposal pr, Listing l, Co2Passport p, Company utilizer, TrustProfile t) {
        double dist = GeoUtil.distanceKm(p.getLatitude(), p.getLongitude(), utilizer.getLatitude(), utilizer.getLongitude());
        PriorityScoring.Result res = PriorityScoring.score(new PriorityScoring.Input(l.getMode(), t.getTier(), t.getHiddenScore(),
                t.getTotalAgreements(), t.getCancellationsBeforeExpiry(), pr.getOfferedPricePerTonne(), l.getBasePricePerTonne(),
                pr.getQuantityTonnes(), l.getVolumeTonnes(), pr.getDurationMonths(), pr.isAcceptsEscrow(), dist));
        pr.setScore(res.total());
        pr.setScoreBreakdown(res.toMap());
    }

    @Transactional(readOnly = true)
    public List<ProposalDto> proposalsFor(UUID listingId) {
        Listing l = lookup.listing(listingId);
        UUID me = current.companyId();
        boolean emitterView = l.getEmitterId().equals(me) || current.isOversight();
        List<Proposal> all = proposals.findByListingIdOrderByScoreDescCreatedAtAsc(listingId);
        List<ProposalDto> out = new ArrayList<>();
        int rank = 0;
        for (Proposal pr : all) {
            if (!emitterView && !pr.getUtilizerId().equals(me)) continue;
            Integer rk = null;
            String rec = null;
            if (pr.getStatus() == ProposalStatus.SUBMITTED || pr.getStatus() == ProposalStatus.AWARDED) {
                rank++;
                rk = rank;
                if (emitterView && rank == 1) rec = recommendation(pr);
            }
            out.add(proposalDto(pr, l, rk, rec));
        }
        return out;
    }

    private String recommendation(Proposal pr) {
        StringBuilder sb = new StringBuilder(String.format("Recommended: %s (score %.1f)", lookup.companyName(pr.getUtilizerId()), pr.getScore()));
        Object comps = pr.getScoreBreakdown().get("components");
        if (comps instanceof List<?> list) {
            List<String> reasons = new ArrayList<>();
            list.stream().filter(o -> o instanceof java.util.Map<?, ?>).map(o -> (java.util.Map<?, ?>) o)
                    .filter(m -> m.get("contribution") instanceof Number n && n.doubleValue() > 0)
                    .sorted((a, b) -> Double.compare(((Number) b.get("contribution")).doubleValue(), ((Number) a.get("contribution")).doubleValue()))
                    .limit(2).forEach(m -> reasons.add(String.valueOf(m.get("explanation"))));
            if (!reasons.isEmpty()) sb.append(" — ").append(String.join("; ", reasons));
        }
        sb.append(". Final decision is yours.");
        return sb.toString();
    }

    @Transactional(readOnly = true)
    public List<ProposalDto> myProposals() {
        return proposals.findByUtilizerIdOrderByCreatedAtDesc(current.companyId()).stream()
                .map(pr -> proposalDto(pr, lookup.listing(pr.getListingId()), null, null)).toList();
    }

    @Transactional
    public ProposalDto withdraw(UUID proposalId) {
        Proposal pr = proposals.findById(proposalId).orElseThrow(() -> new NotFoundException("Proposal not found"));
        if (!pr.getUtilizerId().equals(current.companyId())) throw new ForbiddenException("Not your proposal");
        if (pr.getStatus() != ProposalStatus.SUBMITTED) throw new ConflictException("Only SUBMITTED proposals can be withdrawn");
        pr.setStatus(ProposalStatus.WITHDRAWN);
        proposals.save(pr);
        audit.record("PROPOSAL_WITHDRAWN", "Proposal", proposalId, AuditService.details("listing", pr.getListingId()));
        return proposalDto(pr, lookup.listing(pr.getListingId()), null, null);
    }

    @Transactional
    public AgreementDto award(UUID listingId, UUID proposalId) {
        Listing l = lookup.listing(listingId);
        if (!l.getEmitterId().equals(current.companyId())) throw new ForbiddenException("Not your listing");
        if (l.getStatus() != ListingStatus.OPEN) throw new ConflictException("Listing is not open");
        Proposal winner = proposals.findById(proposalId).filter(x -> x.getListingId().equals(listingId))
                .orElseThrow(() -> new NotFoundException("Proposal not found on this listing"));
        if (winner.getStatus() != ProposalStatus.SUBMITTED) throw new ConflictException("Proposal is " + winner.getStatus());

        Co2Passport p = passports.findByIdForUpdate(l.getPassportId()).orElseThrow(() -> new NotFoundException("Passport not found"));
        double remainder = l.getVolumeTonnes() - winner.getQuantityTonnes();
        if (remainder > 0) p.setAllocatedTonnes(Math.max(0, p.getAllocatedTonnes() - remainder)); // release the unsold part
        p.setUpdatedAt(Instant.now());
        passports.save(p);

        winner.setStatus(ProposalStatus.AWARDED);
        proposals.save(winner);
        for (Proposal other : proposals.findByListingIdOrderByScoreDescCreatedAtAsc(listingId)) {
            if (!other.getId().equals(proposalId) && other.getStatus() == ProposalStatus.SUBMITTED) {
                other.setStatus(ProposalStatus.REJECTED);
                proposals.save(other);
                notifications.notify(other.getUtilizerId(), "PROPOSAL_REJECTED", "Proposal not selected",
                        "Your proposal on " + p.getPassportCode() + " was not selected by the emitter.", "Listing", listingId);
            }
        }
        l.setStatus(ListingStatus.AWARDED);
        listings.save(l);

        Agreement a = agreementService.createFromAward(l, winner, p);
        notifications.notify(winner.getUtilizerId(), "TENDER_AWARDED", (l.getMode() == SaleMode.AUCTION ? "Auction won" : "Tender awarded") + ": " + p.getPassportCode(),
                String.format("%s awarded you %.0f t at ₹%.0f/t. The sale is queued for independent lab approval.",
                        lookup.companyName(l.getEmitterId()), winner.getQuantityTonnes(), winner.getOfferedPricePerTonne()), "Agreement", a.getId());
        audit.record("LISTING_AWARDED", "Listing", listingId, AuditService.details("proposal", proposalId, "utilizer", winner.getUtilizerId(),
                "agreement", a.getId(), "volumeTonnes", winner.getQuantityTonnes(), "releasedRemainderTonnes", Math.max(0, remainder)));
        return agreementService.dto(a);
    }

    // ---- DTO helpers ----

    private boolean canSeeIdentity(Listing l) {
        UUID me = current.companyId();
        return l.getEmitterId().equals(me) || current.isOversight() || proposals.existsByListingIdAndUtilizerId(l.getId(), me);
    }

    public ListingDto dto(Listing l, boolean revealIdentity) {
        Co2Passport p = lookup.passport(l.getPassportId());
        Company e = lookup.company(l.getEmitterId());
        long count = proposals.countByListingIdAndStatus(l.getId(), ProposalStatus.SUBMITTED)
                + proposals.countByListingIdAndStatus(l.getId(), ProposalStatus.AWARDED);
        return new ListingDto(l.getId(), p.getId(), p.getPassportCode(), l.getMode(), l.getStatus(), l.getVolumeTonnes(),
                l.getBasePricePerTonne(), l.getMinPurityPct(), p.getConcentrationPct(), p.getPhysicalState(), p.getCarbonOrigin(),
                p.getCaptureTechnology(), e.getCity(), e.getState(), p.getLatitude(), p.getLongitude(), p.isPipelineConnected(),
                l.getDeliveryWindowStart(), l.getDeliveryWindowEnd(), l.getClosesAt(), l.getDescription(), l.getReservePricePerTonne(),
                revealIdentity ? e.getId() : null, revealIdentity ? e.getName() : null, lookup.tier(e.getId()),
                revealIdentity ? p.getTotalVolumeTonnes() : null, count, l.getCreatedAt());
    }

    public ProposalDto proposalDto(Proposal pr, Listing l, Integer rank, String recommendation) {
        return new ProposalDto(pr.getId(), pr.getListingId(), l.getMode(), lookup.passportCode(l.getPassportId()), pr.getUtilizerId(),
                lookup.companyName(pr.getUtilizerId()), lookup.tier(pr.getUtilizerId()), pr.getQuantityTonnes(), pr.getRequiredPurityPct(),
                pr.getDurationMonths(), pr.getDeliveryRequirement(), pr.getOfferedPricePerTonne(), pr.isAcceptsEscrow(),
                pr.getOtherRequirements(), pr.getStatus(), pr.getScore(), pr.getScoreBreakdown(), rank, recommendation, pr.getCreatedAt());
    }
}
