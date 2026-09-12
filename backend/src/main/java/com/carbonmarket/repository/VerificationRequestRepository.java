package com.carbonmarket.repository;

import com.carbonmarket.domain.VerificationRequest;
import com.carbonmarket.domain.VerificationRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface VerificationRequestRepository extends JpaRepository<VerificationRequest, UUID> {
    List<VerificationRequest> findByStatusInOrderByPriorityDescSubmittedAtAsc(Collection<VerificationRequestStatus> statuses);
    List<VerificationRequest> findByStatusInOrderByDecidedAtDesc(Collection<VerificationRequestStatus> statuses);
    List<VerificationRequest> findByPassportIdOrderBySubmittedAtDesc(UUID passportId);
    List<VerificationRequest> findByPassportIdInOrderBySubmittedAtDesc(Collection<UUID> passportIds);
    List<VerificationRequest> findByAgreementId(UUID agreementId);
}
