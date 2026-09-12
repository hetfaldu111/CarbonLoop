package com.carbonmarket.repository;

import com.carbonmarket.domain.Listing;
import com.carbonmarket.domain.ListingStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ListingRepository extends JpaRepository<Listing, UUID> {
    List<Listing> findByStatusOrderByCreatedAtDesc(ListingStatus status);
    List<Listing> findAllByOrderByCreatedAtDesc();
    List<Listing> findByEmitterIdOrderByCreatedAtDesc(UUID emitterId);
    List<Listing> findByPassportId(UUID passportId);
}
