package com.carbonmarket.repository;

import com.carbonmarket.domain.ContractOffer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ContractOfferRepository extends JpaRepository<ContractOffer, UUID> {
    List<ContractOffer> findByNegotiationIdOrderByVersionAsc(UUID negotiationId);
}
