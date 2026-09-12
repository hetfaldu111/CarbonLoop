package com.carbonmarket.service;

import com.carbonmarket.common.BadRequestException;
import com.carbonmarket.common.ConflictException;
import com.carbonmarket.common.ForbiddenException;
import com.carbonmarket.common.NotFoundException;
import com.carbonmarket.config.CurrentUser;
import com.carbonmarket.domain.*;
import com.carbonmarket.dto.ListingDtos.*;
import com.carbonmarket.repository.*;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Scheduled live ascending auctions.
 *
 * <p>An auction is announced (SCHEDULED), opens at its start time (LIVE) and closes after its
 * duration (ENDED). Each bid adds exactly the listing's fixed increment to the current price —
 * the amount is always computed here and never accepted from the client, so the ladder cannot be
 * manipulated. The last bid standing wins and an agreement is created automatically.
 *
 * <p>Bidding is binding: the bidder accepts up front that winning cannot be cancelled and that a
 * deposit is forfeited if they walk away. That accepted text is stored on the bid.
 */
@Service
public class AuctionService {
    /** Shown to the bidder and stored verbatim on every bid. */
    public static final String BINDING_TERMS =
            "I accept that if this is the last bid when the auction closes, the purchase is binding: "
            + "the resulting agreement cannot be cancelled by me, and any deposit paid is non-refundable if I abandon it.";

    /** A bid in the last minute pushes the close out, so an auction cannot be won by sniping. */
    private static final long ANTI_SNIPE_SECONDS = 60;

    private final ListingRepository listings;
    private final AuctionBidRepository bids;
    private final PassportRepository passports;
    private final CompanyRepository companies;
    private final AgreementRepository agreements;
    private final VerificationRequestRepository verifications;
    private final CurrentUser current;
    private final Lookup lookup;
    private final AuditService audit;
    private final NotificationService notifications;
    private final TrustService trust;
    private final CostService costs;

    public AuctionService(ListingRepository listings, AuctionBidRepository bids, PassportRepository passports,
                          CompanyRepository companies, AgreementRepository agreements,
                          VerificationRequestRepository verifications, CurrentUser current, Lookup lookup,
                          AuditService audit, NotificationService notifications, TrustService trust,
                          @Lazy CostService costs) {
        this.listings = listings;
        this.bids = bids;
        this.passports = passports;
        this.companies = companies;
        this.agreements = agreements;
        this.verifications = verifications;
        this.current = current;
        this.lookup = lookup;
        this.audit = audit;
        this.notifications = notifications;
        this.trust = trust;
        this.costs = costs;
    }

    // ---- Lifecycle -------------------------------------------------------------------

    /** Flips SCHEDULED→LIVE and LIVE→ENDED. Runs on a timer and lazily on every read. */
    @Scheduled(fixedDelay = 10_000)
    @Transactional
    public void advanceAuctions() {
        for (Listing l : listings.findByModeAndStatusIn(SaleMode.AUCTION,
                List.of(ListingStatus.SCHEDULED, ListingStatus.LIVE))) {
            advance(l);
        }
    }

    /** Applies any due transition to one auction. Returns the (possibly updated) listing. */
    @Transactional
    public Listing advance(Listing l) {
        if (l.getMode() != SaleMode.AUCTION) return l;
        Instant now = Instant.now();
        boolean changed = false;
        if (l.getStatus() == ListingStatus.SCHEDULED && l.getScheduledStartAt() != null
                && !now.isBefore(l.getScheduledStartAt())) {
            l.setStatus(ListingStatus.LIVE);
            changed = true;
            audit.record(l.getEmitterId(), Role.EMITTER, "AUCTION_OPENED", "Listing", l.getId(),
                    AuditService.details("basePricePerTonne", l.getBasePricePerTonne(), "volumeTonnes", l.getVolumeTonnes()));
            for (Company u : companies.findByRoleAndStatus(Role.UTILIZER, CompanyStatus.APPROVED)) {
                notifications.notify(u.getId(), "AUCTION_LIVE", "Auction is live: " + lookup.passportCode(l.getPassportId()),
                        String.format("%.0f t opening at ₹%.0f/t, +₹%.0f per bid. Bidding closes %s.",
                                l.getVolumeTonnes(), l.getBasePricePerTonne(),
                                l.getBidIncrement() == null ? 0 : l.getBidIncrement(), l.getClosesAt()), "Listing", l.getId());
            }
        }
        if (l.getStatus() == ListingStatus.LIVE && l.getClosesAt() != null && !now.isBefore(l.getClosesAt())) {
            listings.save(l);
            close(l);
            changed = false; // close() saves
        }
        if (changed) listings.save(l);
        return l;
    }

    /** Settles a finished auction: last bid wins, or the volume goes back to free stock. */
    @Transactional
    public void close(Listing l) {
        AuctionBid winner = bids.findFirstByListingIdOrderByAmountPerTonneDescPlacedAtDesc(l.getId()).orElse(null);
        Co2Passport p = passports.findByIdForUpdate(l.getPassportId())
                .orElseThrow(() -> new NotFoundException("Passport not found"));

        if (winner == null) {
            l.setStatus(ListingStatus.CLOSED);
            listings.save(l);
            p.setAllocatedTonnes(Math.max(0, p.getAllocatedTonnes() - l.getVolumeTonnes()));
            p.setUpdatedAt(Instant.now());
            passports.save(p);
            notifications.notify(l.getEmitterId(), "AUCTION_ENDED", "Auction closed with no bids",
                    String.format("No bids were placed on %.0f t of %s. The volume is back in your free stock.",
                            l.getVolumeTonnes(), p.getPassportCode()), "Listing", l.getId());
            audit.record(l.getEmitterId(), Role.EMITTER, "AUCTION_ENDED_NO_BIDS", "Listing", l.getId(),
                    AuditService.details("releasedTonnes", l.getVolumeTonnes()));
            return;
        }

        l.setStatus(ListingStatus.ENDED);
        listings.save(l);
        Agreement a = createWinningAgreement(l, p, winner);
        l.setStatus(ListingStatus.AWARDED);
        listings.save(l);

        String emitterName = lookup.companyName(l.getEmitterId());
        String winnerName = lookup.companyName(winner.getUtilizerId());
        notifications.notify(winner.getUtilizerId(), "AUCTION_WON", "Auction won: " + p.getPassportCode(),
                String.format("You placed the last bid at ₹%.0f/t for %.0f t from %s (₹%.0f total). "
                                + "This purchase is binding and is now queued for independent lab approval.",
                        winner.getAmountPerTonne(), l.getVolumeTonnes(), emitterName, winner.getTotalAmount()),
                "Agreement", a.getId());
        notifications.notify(l.getEmitterId(), "AUCTION_ENDED", "Auction closed: " + p.getPassportCode(),
                String.format("%s won %.0f t at ₹%.0f/t (₹%.0f total) after %d bids.",
                        winnerName, l.getVolumeTonnes(), winner.getAmountPerTonne(), winner.getTotalAmount(),
                        bids.countByListingId(l.getId())), "Agreement", a.getId());
        audit.record(l.getEmitterId(), Role.EMITTER, "AUCTION_WON", "Listing", l.getId(),
                AuditService.details("winner", winner.getUtilizerId(), "agreement", a.getId(),
                        "finalPricePerTonne", winner.getAmountPerTonne(), "volumeTonnes", l.getVolumeTonnes(),
                        "bidCount", bids.countByListingId(l.getId())));
    }

    private Agreement createWinningAgreement(Listing l, Co2Passport p, AuctionBid winner) {
        Company utilizer = lookup.company(winner.getUtilizerId());
        Agreement a = new Agreement();
        a.setListingId(l.getId());
        a.setEmitterId(l.getEmitterId());
        a.setUtilizerId(winner.getUtilizerId());
        a.setPassportId(p.getId());
        a.setMode(SaleMode.AUCTION);
        a.setVolumeTonnes(l.getVolumeTonnes());
        a.setPricePerTonne(winner.getAmountPerTonne());
        a.setStatus(AgreementStatus.PENDING_VERIFICATION);
        a.setStartsAt(l.getDeliveryWindowStart() == null ? java.time.LocalDate.now() : l.getDeliveryWindowStart());
        a.setDurationMonths(1);
        a.setEndsAt(l.getDeliveryWindowEnd() != null ? l.getDeliveryWindowEnd() : a.getStartsAt().plusMonths(1));
        a.setDepositPct(10.0);
        a.setPricingStructure(PricingStructure.FIXED);
        double dist = com.carbonmarket.common.GeoUtil.distanceKm(p.getLatitude(), p.getLongitude(),
                utilizer.getLatitude(), utilizer.getLongitude());
        a.setCostStack(costs.calculateForPrice(winner.getAmountPerTonne(), p, l.getVolumeTonnes(), TransportMode.TRUCK, dist).toMap());
        agreements.save(a);

        VerificationRequest vr = new VerificationRequest();
        vr.setType(VerificationType.SALE_APPROVAL);
        vr.setPassportId(p.getId());
        vr.setAgreementId(a.getId());
        vr.setPriority(4);
        vr.setClaimedSpecs(PassportService.claimedSpecs(p));
        vr.setNotes("Auction sale approval: " + l.getVolumeTonnes() + " t of " + p.getPassportCode()
                + " to " + utilizer.getName() + " at ₹" + Math.round(winner.getAmountPerTonne()) + "/t");
        verifications.save(vr);

        trust.onAgreementCreated(a.getEmitterId(), a.getUtilizerId());
        trust.refreshBadge(a.getEmitterId());
        for (Company lab : companies.findByRoleAndStatus(Role.LAB, CompanyStatus.APPROVED)) {
            notifications.notify(lab.getId(), "VERIFICATION_QUEUED", "Auction sale awaiting lab approval",
                    "Agreement on " + p.getPassportCode() + " needs approval before it becomes active.",
                    "VerificationRequest", vr.getId());
        }
        return a;
    }

    // ---- Bidding ---------------------------------------------------------------------

    @Transactional
    public AuctionStateDto placeBid(UUID listingId, BidRequest r) {
        Listing l = lookup.listing(listingId);
        if (l.getMode() != SaleMode.AUCTION) throw new BadRequestException("This listing is not an auction");
        advance(l);
        l = lookup.listing(listingId);

        if (l.getStatus() != ListingStatus.LIVE) {
            throw new ConflictException("Auction is " + friendly(l.getStatus()) + "; bids are only accepted while it is live");
        }
        if (!Boolean.TRUE.equals(r == null ? null : r.acceptBindingTerms())) {
            throw new BadRequestException("You must accept the binding terms before bidding: " + BINDING_TERMS);
        }
        UUID me = current.companyId();
        if (me.equals(l.getEmitterId())) throw new ForbiddenException("You cannot bid on your own auction");
        if (me.equals(l.getCurrentLeaderId())) throw new ConflictException("You already hold the leading bid");

        double amount = l.nextBidPricePerTonne();
        double total = Math.round(amount * l.getVolumeTonnes() * 100.0) / 100.0;
        UUID outbid = l.getCurrentLeaderId();

        AuctionBid b = new AuctionBid();
        b.setListingId(listingId);
        b.setUtilizerId(me);
        b.setAmountPerTonne(amount);
        b.setTotalAmount(total);
        b.setBindingAccepted(true);
        b.setBindingTerms(BINDING_TERMS);
        bids.save(b);

        l.setCurrentPricePerTonne(amount);
        l.setCurrentLeaderId(me);
        // Anti-sniping: a late bid gives everyone else another minute.
        Instant now = Instant.now();
        if (l.getClosesAt() != null && l.getClosesAt().minusSeconds(ANTI_SNIPE_SECONDS).isBefore(now)) {
            l.setClosesAt(now.plusSeconds(ANTI_SNIPE_SECONDS));
        }
        listings.save(l);

        String passport = lookup.passportCode(l.getPassportId());
        audit.record("AUCTION_BID", "Listing", listingId, AuditService.details("amountPerTonne", amount,
                "totalAmount", total, "volumeTonnes", l.getVolumeTonnes(), "bidder", me));
        if (outbid != null) {
            notifications.notify(outbid, "OUTBID", "You have been outbid on " + passport,
                    String.format("The bid is now ₹%.0f/t. Bid ₹%.0f/t to lead again.", amount, l.nextBidPricePerTonne()),
                    "Listing", listingId);
        }
        notifications.notify(l.getEmitterId(), "BID_RECEIVED", "New bid on " + passport,
                String.format("%s bid ₹%.0f/t (₹%.0f total).", lookup.companyName(me), amount, total), "Listing", listingId);
        return state(listingId);
    }

    // ---- Reads -----------------------------------------------------------------------

    @Transactional
    public AuctionStateDto state(UUID listingId) {
        Listing l = lookup.listing(listingId);
        if (l.getMode() != SaleMode.AUCTION) throw new BadRequestException("This listing is not an auction");
        advance(l);
        l = lookup.listing(listingId);
        return stateOf(l);
    }

    @Transactional
    public List<AuctionStateDto> list(String filter) {
        List<Listing> all = listings.findByModeOrderByCreatedAtDesc(SaleMode.AUCTION);
        for (Listing l : all) advance(l);
        List<AuctionStateDto> out = new ArrayList<>();
        for (Listing l : listings.findByModeOrderByCreatedAtDesc(SaleMode.AUCTION)) {
            if (!matches(l.getStatus(), filter)) continue;
            out.add(stateOf(l));
        }
        return out;
    }

    @Transactional
    public List<AuctionStateDto> mine() {
        UUID me = current.companyId();
        List<Listing> all = listings.findByModeOrderByCreatedAtDesc(SaleMode.AUCTION);
        for (Listing l : all) if (l.getEmitterId().equals(me)) advance(l);
        List<AuctionStateDto> out = new ArrayList<>();
        for (Listing l : listings.findByModeOrderByCreatedAtDesc(SaleMode.AUCTION)) {
            if (l.getEmitterId().equals(me)) out.add(stateOf(l));
        }
        return out;
    }

    private static boolean matches(ListingStatus s, String filter) {
        if (filter == null || filter.isBlank() || filter.equalsIgnoreCase("all")) return true;
        return switch (filter.toLowerCase()) {
            case "live" -> s == ListingStatus.LIVE;
            case "upcoming" -> s == ListingStatus.SCHEDULED;
            case "ended" -> s == ListingStatus.ENDED || s == ListingStatus.AWARDED || s == ListingStatus.CLOSED;
            default -> true;
        };
    }

    /**
     * Builds the pollable auction state. During a live auction rival bidders are shown as stable
     * pseudonyms ("Bidder #1", numbered by when they first bid) so the room stays anonymous; the
     * emitter and oversight roles always see real names, and the winner is revealed once it ends.
     */
    private AuctionStateDto stateOf(Listing l) {
        UUID me = current.companyId();
        boolean revealNames = l.getEmitterId().equals(me) || current.isOversight();
        boolean finished = l.getStatus() == ListingStatus.ENDED || l.getStatus() == ListingStatus.AWARDED
                || l.getStatus() == ListingStatus.CLOSED;

        List<AuctionBid> ordered = bids.findByListingIdOrderByPlacedAtAsc(l.getId());
        Map<UUID, String> pseudonyms = new LinkedHashMap<>();
        for (AuctionBid b : ordered) {
            pseudonyms.computeIfAbsent(b.getUtilizerId(), k -> "Bidder #" + (pseudonyms.size() + 1));
        }

        List<AuctionBidDto> bidDtos = new ArrayList<>();
        for (int i = ordered.size() - 1; i >= 0; i--) {
            AuctionBid b = ordered.get(i);
            boolean isYou = b.getUtilizerId().equals(me);
            boolean showReal = revealNames || isYou || (finished && b.getUtilizerId().equals(l.getCurrentLeaderId()));
            bidDtos.add(new AuctionBidDto(showReal ? lookup.companyName(b.getUtilizerId()) : pseudonyms.get(b.getUtilizerId()),
                    lookup.tier(b.getUtilizerId()), b.getAmountPerTonne(), b.getTotalAmount(), b.getPlacedAt(), isYou,
                    showReal ? b.getUtilizerId() : null));
        }

        AuctionLeaderDto leader = null;
        if (l.getCurrentLeaderId() != null) {
            boolean isYou = l.getCurrentLeaderId().equals(me);
            boolean showReal = revealNames || isYou || finished;
            leader = new AuctionLeaderDto(showReal ? l.getCurrentLeaderId() : null,
                    showReal ? lookup.companyName(l.getCurrentLeaderId()) : pseudonyms.get(l.getCurrentLeaderId()),
                    lookup.tier(l.getCurrentLeaderId()), isYou);
        }

        Instant now = Instant.now();
        Instant until = l.getStatus() == ListingStatus.SCHEDULED ? l.getScheduledStartAt() : l.getClosesAt();
        long secondsRemaining = until == null ? 0 : Math.max(0, ChronoUnit.SECONDS.between(now, until));

        String blocked = null;
        boolean canBid = false;
        if (current.is(Role.UTILIZER)) {
            if (l.getStatus() == ListingStatus.SCHEDULED) blocked = "Auction has not started yet";
            else if (l.getStatus() != ListingStatus.LIVE) blocked = "Auction is " + friendly(l.getStatus());
            else if (me.equals(l.getCurrentLeaderId())) blocked = "You already hold the leading bid";
            else canBid = true;
        } else {
            blocked = l.getEmitterId().equals(me) ? "You are the seller in this auction" : "Only utilizers can bid";
        }

        Co2Passport p = lookup.passport(l.getPassportId());
        Company e = lookup.company(l.getEmitterId());
        UUID agreementId = agreements.findByPassportId(l.getPassportId()).stream()
                .filter(a -> l.getId().equals(a.getListingId()))
                .map(Agreement::getId).findFirst().orElse(null);

        return new AuctionStateDto(l.getId(), p.getId(), p.getPassportCode(), l.getStatus(), l.getScheduledStartAt(),
                l.getClosesAt(), now, secondsRemaining, l.getBasePricePerTonne(),
                l.getBidIncrement() == null ? 0 : l.getBidIncrement(), l.getCurrentPricePerTonne(),
                l.nextBidPricePerTonne(), l.getVolumeTonnes(),
                l.getCurrentPricePerTonne() == null ? null
                        : Math.round(l.getCurrentPricePerTonne() * l.getVolumeTonnes() * 100.0) / 100.0,
                leader, ordered.size(), me.equals(l.getCurrentLeaderId()), canBid, blocked, BINDING_TERMS,
                revealNames || finished ? e.getId() : null, revealNames || finished ? e.getName() : null,
                lookup.tier(e.getId()), e.getCity(), e.getState(), p.getConcentrationPct(),
                p.getCaptureTechnology(), p.getPhysicalState(), agreementId, bidDtos);
    }

    private static String friendly(ListingStatus s) {
        return switch (s) {
            case SCHEDULED -> "not open yet";
            case LIVE -> "live";
            case ENDED, AWARDED -> "finished";
            case CLOSED -> "closed";
            case CANCELLED -> "cancelled";
            default -> s.name().toLowerCase();
        };
    }
}
