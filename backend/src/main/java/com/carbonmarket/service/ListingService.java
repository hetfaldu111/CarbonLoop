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
import com.carbonmarket.scoring.TenderOptimizer;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
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
    private final CompanyRepository companies;
    private final AuctionService auctions;
    private final AuctionBidRepository auctionBids;

    public ListingService(ListingRepository listings, PassportRepository passports, ProposalRepository proposals,
                          TrustProfileRepository trustProfiles, CurrentUser current, Lookup lookup, AuditService audit,
                          NotificationService notifications, AgreementService agreementService, TrustService trustService,
                          CompanyRepository companies, @Lazy AuctionService auctions,
                          AuctionBidRepository auctionBids) {
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
        this.companies = companies;
        this.auctions = auctions;
        this.auctionBids = auctionBids;
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
        l.setDescription(r.description());

        if (r.mode() == SaleMode.AUCTION) {
            configureAuction(l, r);
        } else {
            l.setStatus(ListingStatus.OPEN);
            l.setClosesAt(r.closesAt());
            l.setDeliveryMonths(r.deliveryMonths());
            l.setMonthlyTonnes(r.monthlyTonnes() != null ? r.monthlyTonnes()
                    : (r.deliveryMonths() != null && r.deliveryMonths() > 0
                        ? Math.round(r.volumeTonnes() / r.deliveryMonths() * 100.0) / 100.0 : null));
        }
        listings.save(l);
        audit.record("LISTING_CREATED", "Listing", l.getId(), AuditService.details("passport", p.getPassportCode(), "mode", r.mode().name(),
                "volumeTonnes", r.volumeTonnes(), "basePricePerTonne", r.basePricePerTonne(), "lockedTonnes", r.volumeTonnes()));
        broadcastToUtilizers(l, p);
        return dto(l, true);
    }

    /** Validates and applies the auction schedule: opening price, fixed increment, start and duration. */
    private void configureAuction(Listing l, ListingRequest r) {
        if (r.bidIncrement() == null || r.bidIncrement() <= 0) {
            throw new BadRequestException("An auction needs a bid increment greater than zero");
        }
        if (r.durationMinutes() == null || r.durationMinutes() <= 0) {
            throw new BadRequestException("An auction needs a duration in minutes greater than zero");
        }
        Instant start = r.scheduledStartAt() == null ? Instant.now() : r.scheduledStartAt();
        if (start.isBefore(Instant.now().minusSeconds(60))) {
            throw new BadRequestException("The auction start time must be in the future");
        }
        l.setBidIncrement(r.bidIncrement());
        l.setScheduledStartAt(start);
        l.setDurationMinutes(r.durationMinutes());
        l.setClosesAt(start.plusSeconds(r.durationMinutes() * 60L));
        l.setReservePricePerTonne(null); // the opening price is the floor; a separate reserve would be redundant
        l.setStatus(start.isAfter(Instant.now()) ? ListingStatus.SCHEDULED : ListingStatus.LIVE);
    }

    /** Every approved utilizer hears about a new tender or auction the moment it is published. */
    private void broadcastToUtilizers(Listing l, Co2Passport p) {
        boolean auction = l.getMode() == SaleMode.AUCTION;
        String title = auction
                ? String.format("Auction scheduled: %.0f t of %.1f%% CO2 from ₹%.0f/t", l.getVolumeTonnes(),
                        p.getConcentrationPct() == null ? 0 : p.getConcentrationPct(), l.getBasePricePerTonne())
                : String.format("New tender: %.0f t of %.1f%% CO2 at ₹%.0f/t", l.getVolumeTonnes(),
                        p.getConcentrationPct() == null ? 0 : p.getConcentrationPct(), l.getBasePricePerTonne());
        String body = auction
                ? String.format("Bidding opens %s and runs for %d minutes, rising ₹%.0f per bid. Winning is binding.",
                        l.getScheduledStartAt(), l.getDurationMinutes() == null ? 0 : l.getDurationMinutes(), l.getBidIncrement())
                : String.format("%s, %s. Apply for any volume up to %.0f t at or above ₹%.0f/t%s. Applications close %s.",
                        p.getPhysicalState(), p.getCaptureTechnology(), l.getVolumeTonnes(), l.getBasePricePerTonne(),
                        l.getDeliveryMonths() == null ? ""
                                : String.format(" (%.0f t per month for %d months)", l.getMonthlyTonnes() == null ? 0 : l.getMonthlyTonnes(), l.getDeliveryMonths()),
                        l.getClosesAt());
        for (Company u : companies.findByRoleAndStatus(Role.UTILIZER, CompanyStatus.APPROVED)) {
            notifications.notify(u.getId(), auction ? "AUCTION_SCHEDULED" : "TENDER_PUBLISHED", title, body, "Listing", l.getId());
        }
    }

    @Transactional
    public List<ListingDto> discover(SaleMode mode, ListingStatus status, Double minPurity, String state) {
        // Tenders are OPEN; auctions are SCHEDULED or LIVE. With no explicit filter, show anything
        // a buyer can still act on.
        List<Listing> source = status == null
                ? listings.findByStatusInOrderByCreatedAtDesc(List.of(ListingStatus.OPEN, ListingStatus.SCHEDULED, ListingStatus.LIVE))
                : listings.findByStatusOrderByCreatedAtDesc(status);
        List<ListingDto> out = new ArrayList<>();
        for (Listing l : source) {
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
        if (!l.getStatus().isActive()) throw new ConflictException("Only open or scheduled listings can be cancelled");
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
        if (l.getMode() == SaleMode.AUCTION) {
            throw new BadRequestException("This is a live auction - place a bid with POST /api/listings/" + listingId + "/bids");
        }
        if (l.getStatus() != ListingStatus.OPEN) throw new ConflictException("Listing is not open");
        if (l.getClosesAt() != null && l.getClosesAt().isBefore(Instant.now())) throw new ConflictException("Listing has closed");
        UUID me = current.companyId();
        if (proposals.findByListingIdAndUtilizerIdAndStatus(listingId, me, ProposalStatus.SUBMITTED).isPresent()) {
            throw new ConflictException("You already have an active proposal on this listing; withdraw it first");
        }
        if (r.quantityTonnes() > l.getVolumeTonnes() + 1e-9) {
            throw new BadRequestException(String.format("Requested %.1f t exceeds listed %.1f t", r.quantityTonnes(), l.getVolumeTonnes()));
        }
        if (r.offeredPricePerTonne() < l.getBasePricePerTonne() - 1e-9) {
            throw new BadRequestException(String.format("Offered \u20b9%.0f/t is below the base price of \u20b9%.0f/t",
                    r.offeredPricePerTonne(), l.getBasePricePerTonne()));
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

    // ---- Profit-optimal multi-award ----

    /**
     * The combination of proposals that earns the emitter the most money without exceeding the
     * volume released, plus two alternatives for context and the per-proposal reliability score.
     * Exact arithmetic (see {@link TenderOptimizer}) - the emitter still decides.
     */
    @Transactional(readOnly = true)
    public AwardSuggestionDto awardSuggestion(UUID listingId) {
        Listing l = lookup.listing(listingId);
        if (!l.getEmitterId().equals(current.companyId()) && !current.isOversight()) {
            throw new ForbiddenException("Not your listing");
        }
        List<Proposal> open = proposals.findByListingIdOrderByScoreDescCreatedAtAsc(listingId).stream()
                .filter(pr -> pr.getStatus() == ProposalStatus.SUBMITTED).toList();

        List<Proposal> byTime = new ArrayList<>(open);
        byTime.sort(Comparator.comparing(Proposal::getCreatedAt));
        List<TenderOptimizer.Item> items = new ArrayList<>();
        List<Double> scores = new ArrayList<>();
        for (Proposal pr : open) {
            TrustProfile t = trustService.getOrCreate(pr.getUtilizerId());
            items.add(new TenderOptimizer.Item(pr.getId(), pr.getQuantityTonnes(), pr.getOfferedPricePerTonne(),
                    t.getTier(), t.getHiddenScore(), byTime.indexOf(pr)));
            scores.add(pr.getScore() == null ? 0 : pr.getScore());
        }

        double capacity = l.getVolumeTonnes();
        TenderOptimizer.Selection best = TenderOptimizer.solve(items, capacity);
        TenderOptimizer.Selection single = TenderOptimizer.bestSingle(items, capacity);
        TenderOptimizer.Selection trustPick = TenderOptimizer.bestTrustWeighted(items, scores, capacity);

        Set<UUID> chosen = new LinkedHashSet<>(best.proposalIds());
        List<ProposalOptionDto> perProposal = new ArrayList<>();
        for (Proposal pr : open) {
            perProposal.add(new ProposalOptionDto(pr.getId(), pr.getUtilizerId(), lookup.companyName(pr.getUtilizerId()),
                    lookup.tier(pr.getUtilizerId()), pr.getQuantityTonnes(), pr.getOfferedPricePerTonne(),
                    round(pr.getQuantityTonnes() * pr.getOfferedPricePerTonne()), chosen.contains(pr.getId()),
                    pr.getScore(), pr.getScoreBreakdown(), pr.getCreatedAt()));
        }
        perProposal.sort(Comparator.comparingDouble(ProposalOptionDto::revenue).reversed());

        List<SelectionDto> alternatives = new ArrayList<>();
        if (!single.proposalIds().isEmpty() && !sameSet(single, best)) {
            alternatives.add(selectionDto("Highest single bidder", single));
        }
        if (!trustPick.proposalIds().isEmpty() && !sameSet(trustPick, best) && !sameSet(trustPick, single)) {
            alternatives.add(selectionDto("Best trust-weighted", trustPick));
        }
        return new AwardSuggestionDto(listingId, capacity, best.exact(), selectionDto("Most revenue", best),
                alternatives, explain(best, single, capacity), perProposal);
    }

    private static boolean sameSet(TenderOptimizer.Selection a, TenderOptimizer.Selection b) {
        return new LinkedHashSet<>(a.proposalIds()).equals(new LinkedHashSet<>(b.proposalIds()));
    }

    private SelectionDto selectionDto(String label, TenderOptimizer.Selection sel) {
        List<String> names = sel.proposalIds().stream()
                .map(id -> proposals.findById(id).map(pr -> lookup.companyName(pr.getUtilizerId())).orElse("?")).toList();
        return new SelectionDto(label, sel.proposalIds(), sel.totalRevenue(), sel.totalTonnes(), sel.leftoverTonnes(), names);
    }

    private String explain(TenderOptimizer.Selection best, TenderOptimizer.Selection single, double capacity) {
        if (best.proposalIds().isEmpty()) return "No open proposals fit the volume released.";
        List<String> parts = new ArrayList<>();
        for (UUID id : best.proposalIds()) {
            proposals.findById(id).ifPresent(pr -> parts.add(String.format("%s (%.0f t)",
                    lookup.companyName(pr.getUtilizerId()), pr.getQuantityTonnes())));
        }
        StringBuilder sb = new StringBuilder("Accepting " + String.join(" and ", parts)
                + String.format(" earns \u20b9%s", money(best.totalRevenue())));
        double delta = best.totalRevenue() - single.totalRevenue();
        if (best.proposalIds().size() > 1 && delta > 0.005) {
            sb.append(String.format(", which is \u20b9%s more than the best single bidder", money(delta)));
        }
        sb.append(String.format(". They use %.0f t of the %.0f t released", best.totalTonnes(), capacity));
        if (best.leftoverTonnes() > 0.005) {
            sb.append(String.format("; the remaining %.0f t returns to your free stock", best.leftoverTonnes()));
        }
        sb.append(". The decision is yours.");
        if (!best.exact()) sb.append(" (Too many proposals to search exhaustively; this is a best-effort pick.)");
        return sb.toString();
    }

    /** Indian digit grouping, so 4300000 reads as 43,00,000. */
    static String money(double v) {
        long n = Math.round(v);
        String s = Long.toString(Math.abs(n));
        if (s.length() <= 3) return (n < 0 ? "-" : "") + s;
        String last3 = s.substring(s.length() - 3);
        String rest = s.substring(0, s.length() - 3);
        StringBuilder out = new StringBuilder();
        while (rest.length() > 2) {
            out.insert(0, "," + rest.substring(rest.length() - 2));
            rest = rest.substring(0, rest.length() - 2);
        }
        return (n < 0 ? "-" : "") + rest + out + "," + last3;
    }

    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }

    /**
     * Awards one or more proposals. Every winner gets its own agreement and its own lab approval;
     * whatever volume is not awarded goes straight back to the free stock on the passport.
     */
    @Transactional
    public List<AgreementDto> award(UUID listingId, List<UUID> proposalIds) {
        Listing l = lookup.listing(listingId);
        if (!l.getEmitterId().equals(current.companyId())) throw new ForbiddenException("Not your listing");
        if (l.getStatus() != ListingStatus.OPEN) throw new ConflictException("Listing is not open");
        if (proposalIds == null || proposalIds.isEmpty()) throw new BadRequestException("Select at least one proposal to award");

        List<UUID> unique = new ArrayList<>(new LinkedHashSet<>(proposalIds));
        List<Proposal> winners = new ArrayList<>();
        double awarded = 0;
        for (UUID pid : unique) {
            Proposal pr = proposals.findById(pid).filter(x -> x.getListingId().equals(listingId))
                    .orElseThrow(() -> new NotFoundException("Proposal not found on this listing: " + pid));
            if (pr.getStatus() != ProposalStatus.SUBMITTED) {
                throw new BadRequestException("Proposal from " + lookup.companyName(pr.getUtilizerId()) + " is " + pr.getStatus());
            }
            winners.add(pr);
            awarded += pr.getQuantityTonnes();
        }
        if (awarded > l.getVolumeTonnes() + 1e-9) {
            throw new BadRequestException(String.format("Selected %.1f t exceeds the %.1f t released in this tender",
                    awarded, l.getVolumeTonnes()));
        }

        Co2Passport p = passports.findByIdForUpdate(l.getPassportId()).orElseThrow(() -> new NotFoundException("Passport not found"));
        double leftover = l.getVolumeTonnes() - awarded;
        if (leftover > 0) p.setAllocatedTonnes(Math.max(0, p.getAllocatedTonnes() - leftover));
        p.setUpdatedAt(Instant.now());
        passports.save(p);

        List<AgreementDto> created = new ArrayList<>();
        double totalRevenue = 0;
        for (Proposal winner : winners) {
            winner.setStatus(ProposalStatus.AWARDED);
            proposals.save(winner);
            Agreement a = agreementService.createFromAward(l, winner, p);
            created.add(agreementService.dto(a));
            totalRevenue += winner.getQuantityTonnes() * winner.getOfferedPricePerTonne();
            notifications.notify(winner.getUtilizerId(), "TENDER_AWARDED", "Tender awarded: " + p.getPassportCode(),
                    String.format("%s awarded you %.0f t at \u20b9%.0f/t. The sale is queued for independent lab approval.",
                            lookup.companyName(l.getEmitterId()), winner.getQuantityTonnes(), winner.getOfferedPricePerTonne()),
                    "Agreement", a.getId());
        }

        Set<UUID> won = new LinkedHashSet<>(unique);
        for (Proposal other : proposals.findByListingIdOrderByScoreDescCreatedAtAsc(listingId)) {
            if (!won.contains(other.getId()) && other.getStatus() == ProposalStatus.SUBMITTED) {
                other.setStatus(ProposalStatus.REJECTED);
                proposals.save(other);
                notifications.notify(other.getUtilizerId(), "PROPOSAL_REJECTED", "Proposal not selected",
                        "Your proposal on " + p.getPassportCode() + " was not selected by the emitter.", "Listing", listingId);
            }
        }
        l.setStatus(ListingStatus.AWARDED);
        listings.save(l);
        trustService.refreshBadge(l.getEmitterId());

        audit.record("TENDER_AWARDED", "Listing", listingId, AuditService.details("proposals", unique,
                "winners", winners.stream().map(w -> lookup.companyName(w.getUtilizerId())).toList(),
                "awardedTonnes", round(awarded), "totalRevenue", round(totalRevenue),
                "releasedRemainderTonnes", round(Math.max(0, leftover))));
        return created;
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
                revealIdentity ? p.getTotalVolumeTonnes() : null, count, l.getCreatedAt(),
                l.getDeliveryMonths(), l.getMonthlyTonnes(), l.getBidIncrement(), l.getScheduledStartAt(),
                l.getDurationMinutes(), l.getCurrentPricePerTonne(), auctionBids.countByListingId(l.getId()));
    }

    public ProposalDto proposalDto(Proposal pr, Listing l, Integer rank, String recommendation) {
        return new ProposalDto(pr.getId(), pr.getListingId(), l.getMode(), lookup.passportCode(l.getPassportId()), pr.getUtilizerId(),
                lookup.companyName(pr.getUtilizerId()), lookup.tier(pr.getUtilizerId()), pr.getQuantityTonnes(), pr.getRequiredPurityPct(),
                pr.getDurationMonths(), pr.getDeliveryRequirement(), pr.getOfferedPricePerTonne(), pr.isAcceptsEscrow(),
                pr.getOtherRequirements(), pr.getStatus(), pr.getScore(), pr.getScoreBreakdown(), rank, recommendation, pr.getCreatedAt());
    }
}
