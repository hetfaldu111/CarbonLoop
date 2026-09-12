package com.carbonmarket.repository;

import com.carbonmarket.domain.Negotiation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NegotiationRepository extends JpaRepository<Negotiation, UUID> {
    List<Negotiation> findByEmitterIdOrUtilizerIdOrderByCreatedAtDesc(UUID emitterId, UUID utilizerId);
    List<Negotiation> findAllByOrderByCreatedAtDesc();
}
