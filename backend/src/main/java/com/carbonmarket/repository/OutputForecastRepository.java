package com.carbonmarket.repository;

import com.carbonmarket.domain.OutputForecast;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OutputForecastRepository extends JpaRepository<OutputForecast, UUID> {
    List<OutputForecast> findByPassportIdOrderByPeriodStartAsc(UUID passportId);
}
