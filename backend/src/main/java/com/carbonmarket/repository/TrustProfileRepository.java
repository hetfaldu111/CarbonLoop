package com.carbonmarket.repository;

import com.carbonmarket.domain.TrustProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface TrustProfileRepository extends JpaRepository<TrustProfile, UUID> {
}
