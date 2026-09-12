package com.carbonmarket.repository;

import com.carbonmarket.domain.Shipment;
import com.carbonmarket.domain.ShipmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ShipmentRepository extends JpaRepository<Shipment, UUID> {
    List<Shipment> findByAgreementIdInOrderByCreatedAtDesc(Collection<UUID> agreementIds);
    List<Shipment> findByAgreementIdOrderByCreatedAtDesc(UUID agreementId);
    List<Shipment> findByTransportProviderIdOrderByCreatedAtDesc(UUID providerId);
    List<Shipment> findAllByOrderByCreatedAtDesc();
    List<Shipment> findByStatus(ShipmentStatus status);
}
