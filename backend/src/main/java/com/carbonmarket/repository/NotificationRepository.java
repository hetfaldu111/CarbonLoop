package com.carbonmarket.repository;

import com.carbonmarket.domain.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    List<Notification> findByCompanyIdOrderByCreatedAtDesc(UUID companyId);
    long countByCompanyIdAndReadFalse(UUID companyId);
    List<Notification> findByCompanyIdAndReadFalse(UUID companyId);
}
