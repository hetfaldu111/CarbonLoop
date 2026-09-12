package com.carbonmarket.repository;

import com.carbonmarket.domain.Co2Passport;
import com.carbonmarket.domain.LabCertificateStatus;
import com.carbonmarket.domain.VerificationStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PassportRepository extends JpaRepository<Co2Passport, UUID> {
    /** Row-level lock (SELECT ... FOR UPDATE) so concurrent allocations serialize on the passport row. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Co2Passport p where p.id = :id")
    Optional<Co2Passport> findByIdForUpdate(@Param("id") UUID id);

    List<Co2Passport> findByEmitterIdOrderByCreatedAtDesc(UUID emitterId);
    List<Co2Passport> findByVerificationStatus(VerificationStatus status);
    List<Co2Passport> findByCoaExpiresAtBeforeAndLabCertificateStatus(Instant before, LabCertificateStatus status);
    List<Co2Passport> findByCoaExpiresAtBetween(Instant from, Instant to);
    Optional<Co2Passport> findByPassportCode(String code);

    @Query("select max(p.passportCode) from Co2Passport p")
    Optional<String> findMaxPassportCode();
}
