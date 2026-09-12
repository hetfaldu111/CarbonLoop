package com.carbonmarket.repository;

import com.carbonmarket.domain.Agreement;
import com.carbonmarket.domain.AgreementStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface AgreementRepository extends JpaRepository<Agreement, UUID> {
    List<Agreement> findByEmitterIdOrUtilizerIdOrderByCreatedAtDesc(UUID emitterId, UUID utilizerId);
    List<Agreement> findAllByOrderByCreatedAtDesc();
    List<Agreement> findByPassportId(UUID passportId);
    List<Agreement> findByPassportIdAndStatus(UUID passportId, AgreementStatus status);
    List<Agreement> findByStatusIn(Collection<AgreementStatus> statuses);
    List<Agreement> findByStatus(AgreementStatus status);
    List<Agreement> findByEmitterIdAndStatusIn(UUID emitterId, Collection<AgreementStatus> statuses);
}
