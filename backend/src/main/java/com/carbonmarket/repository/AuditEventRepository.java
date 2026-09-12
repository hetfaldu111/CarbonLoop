package com.carbonmarket.repository;

import com.carbonmarket.domain.AuditEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {
    Optional<AuditEvent> findTopByOrderByIdDesc();
    Page<AuditEvent> findAllByOrderByIdDesc(Pageable pageable);
}
