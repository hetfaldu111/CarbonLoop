package com.carbonmarket;

import com.carbonmarket.domain.*;
import com.carbonmarket.repository.*;
import com.carbonmarket.seed.DataSeeder;
import com.carbonmarket.service.AuctionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Settlement is what happens when the clock runs out, so it is exercised directly rather than by
 * waiting on the scheduler.
 */
@SpringBootTest(properties = "app.seed=true")
@ActiveProfiles("h2")
class AuctionSettlementTest {

    @Autowired AuctionService auctions;
    @Autowired ListingRepository listings;
    @Autowired AuctionBidRepository bids;
    @Autowired PassportRepository passports;
    @Autowired AgreementRepository agreements;
    @Autowired VerificationRequestRepository verifications;

    private Listing newAuction(UUID passportId, UUID emitterId, double volume, double base, double increment) {
        Co2Passport p = passports.findById(passportId).orElseThrow();
        p.setAllocatedTonnes(p.getAllocatedTonnes() + volume); // the listing locks its volume
        passports.save(p);

        Listing l = new Listing();
        l.setPassportId(passportId);
        l.setEmitterId(emitterId);
        l.setMode(SaleMode.AUCTION);
        l.setStatus(ListingStatus.LIVE);
        l.setVolumeTonnes(volume);
        l.setBasePricePerTonne(base);
        l.setBidIncrement(increment);
        l.setScheduledStartAt(Instant.now().minus(5, ChronoUnit.MINUTES));
        l.setDurationMinutes(5);
        l.setClosesAt(Instant.now().minusSeconds(1));
        return listings.save(l);
    }

    @Test
    @DisplayName("an auction that attracted no bids gives the volume back to the emitter")
    void noBidsReleasesTheVolume() {
        Co2Passport before = passports.findById(DataSeeder.P344).orElseThrow();
        double freeBefore = before.freeTonnes();

        Listing l = newAuction(DataSeeder.P344, DataSeeder.POWER, 25, 4000, 100);
        assertEquals(freeBefore - 25, passports.findById(DataSeeder.P344).orElseThrow().freeTonnes(), 0.01);

        auctions.close(l);

        assertEquals(ListingStatus.CLOSED, listings.findById(l.getId()).orElseThrow().getStatus());
        assertEquals(freeBefore, passports.findById(DataSeeder.P344).orElseThrow().freeTonnes(), 0.01,
                "the unsold volume is back in free stock");
    }

    @Test
    @DisplayName("the last bid wins: an agreement and a lab approval are raised automatically")
    void lastBidWinsAndBecomesAnAgreement() {
        Listing l = newAuction(DataSeeder.P344, DataSeeder.POWER, 30, 4000, 100);

        bid(l, DataSeeder.METHANOL, 4000);
        bid(l, DataSeeder.ALGAE, 4100);
        AuctionBid last = bid(l, DataSeeder.METHANOL, 4200);
        l.setCurrentPricePerTonne(4200.0);
        l.setCurrentLeaderId(DataSeeder.METHANOL);
        listings.save(l);

        int agreementsBefore = agreements.findAll().size();
        auctions.close(l);

        Listing after = listings.findById(l.getId()).orElseThrow();
        assertEquals(ListingStatus.AWARDED, after.getStatus());
        assertEquals(agreementsBefore + 1, agreements.findAll().size());

        Agreement won = agreements.findAll().stream()
                .filter(a -> l.getId().equals(a.getListingId())).findFirst().orElseThrow();
        assertEquals(DataSeeder.METHANOL, won.getUtilizerId(), "the last bidder wins");
        assertEquals(last.getAmountPerTonne(), won.getPricePerTonne(), 0.01);
        assertEquals(30.0, won.getVolumeTonnes(), 0.01, "the winner takes the whole lot");
        assertEquals(AgreementStatus.PENDING_VERIFICATION, won.getStatus());
        assertEquals(SaleMode.AUCTION, won.getMode());

        boolean labQueued = verifications.findAll().stream()
                .anyMatch(v -> won.getId().equals(v.getAgreementId())
                        && v.getType() == VerificationType.SALE_APPROVAL
                        && v.getStatus() == VerificationRequestStatus.QUEUED);
        assertTrue(labQueued, "an auction sale still needs independent lab approval");
    }

    @Test
    @DisplayName("the scheduler opens an auction once its start time passes")
    void scheduledAuctionGoesLive() {
        Co2Passport p = passports.findById(DataSeeder.P344).orElseThrow();
        p.setAllocatedTonnes(p.getAllocatedTonnes() + 10);
        passports.save(p);

        Listing l = new Listing();
        l.setPassportId(DataSeeder.P344);
        l.setEmitterId(DataSeeder.POWER);
        l.setMode(SaleMode.AUCTION);
        l.setStatus(ListingStatus.SCHEDULED);
        l.setVolumeTonnes(10);
        l.setBasePricePerTonne(4000);
        l.setBidIncrement(50.0);
        l.setScheduledStartAt(Instant.now().minusSeconds(2)); // due
        l.setDurationMinutes(30);
        l.setClosesAt(Instant.now().plus(30, ChronoUnit.MINUTES));
        listings.save(l);

        auctions.advanceAuctions();

        assertEquals(ListingStatus.LIVE, listings.findById(l.getId()).orElseThrow().getStatus());
    }

    private AuctionBid bid(Listing l, UUID utilizer, double perTonne) {
        AuctionBid b = new AuctionBid();
        b.setListingId(l.getId());
        b.setUtilizerId(utilizer);
        b.setAmountPerTonne(perTonne);
        b.setTotalAmount(perTonne * l.getVolumeTonnes());
        b.setBindingAccepted(true);
        b.setBindingTerms(AuctionService.BINDING_TERMS);
        b.setPlacedAt(Instant.now().minusSeconds(List.of(30L, 20L, 10L).get(0)));
        return bids.save(b);
    }
}
