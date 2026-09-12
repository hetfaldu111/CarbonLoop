package com.carbonmarket.repository;

import com.carbonmarket.domain.AuctionBid;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AuctionBidRepository extends JpaRepository<AuctionBid, UUID> {
    List<AuctionBid> findByListingIdOrderByPlacedAtAsc(UUID listingId);
    List<AuctionBid> findByListingIdOrderByAmountPerTonneDescPlacedAtDesc(UUID listingId);
    Optional<AuctionBid> findFirstByListingIdOrderByAmountPerTonneDescPlacedAtDesc(UUID listingId);
    long countByListingId(UUID listingId);
}
