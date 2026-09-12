package com.carbonmarket.repository;

import com.carbonmarket.domain.Proposal;
import com.carbonmarket.domain.ProposalStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProposalRepository extends JpaRepository<Proposal, UUID> {
    List<Proposal> findByListingIdOrderByScoreDescCreatedAtAsc(UUID listingId);
    List<Proposal> findByUtilizerIdOrderByCreatedAtDesc(UUID utilizerId);
    Optional<Proposal> findByListingIdAndUtilizerIdAndStatus(UUID listingId, UUID utilizerId, ProposalStatus status);
    boolean existsByListingIdAndUtilizerId(UUID listingId, UUID utilizerId);
    long countByListingIdAndStatus(UUID listingId, ProposalStatus status);
}
