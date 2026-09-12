package com.carbonmarket.repository;

import com.carbonmarket.domain.TransportOffer;
import com.carbonmarket.domain.TransportOfferStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TransportOfferRepository extends JpaRepository<TransportOffer, UUID> {
    List<TransportOffer> findByProviderIdOrderByCreatedAtDesc(UUID providerId);
    List<TransportOffer> findByShipmentId(UUID shipmentId);
    List<TransportOffer> findByShipmentIdAndStatus(UUID shipmentId, TransportOfferStatus status);
}
