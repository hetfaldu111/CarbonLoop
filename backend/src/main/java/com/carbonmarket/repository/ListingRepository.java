package com.carbonmarket.repository;

import com.carbonmarket.domain.Listing;
import com.carbonmarket.domain.ListingStatus;
import com.carbonmarket.domain.SaleMode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ListingRepository extends JpaRepository<Listing, UUID> {
    List<Listing> findByStatusOrderByCreatedAtDesc(ListingStatus status);
    List<Listing> findAllByOrderByCreatedAtDesc();
    List<Listing> findByEmitterIdOrderByCreatedAtDesc(UUID emitterId);
    List<Listing> findByPassportId(UUID passportId);
    List<Listing> findByStatusInOrderByCreatedAtDesc(Collection<ListingStatus> statuses);
    List<Listing> findByModeAndStatusIn(SaleMode mode, Collection<ListingStatus> statuses);
    List<Listing> findByModeOrderByCreatedAtDesc(SaleMode mode);
}
