package com.carbonmarket.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "output_forecasts")
public class OutputForecast {
    @Id private UUID id = UUID.randomUUID();
    private UUID passportId;
    private LocalDate periodStart;
    private LocalDate periodEnd;
    private double expectedTonnesPerDay;
    private String reason;
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getPassportId() { return passportId; }
    public void setPassportId(UUID passportId) { this.passportId = passportId; }
    public LocalDate getPeriodStart() { return periodStart; }
    public void setPeriodStart(LocalDate periodStart) { this.periodStart = periodStart; }
    public LocalDate getPeriodEnd() { return periodEnd; }
    public void setPeriodEnd(LocalDate periodEnd) { this.periodEnd = periodEnd; }
    public double getExpectedTonnesPerDay() { return expectedTonnesPerDay; }
    public void setExpectedTonnesPerDay(double expectedTonnesPerDay) { this.expectedTonnesPerDay = expectedTonnesPerDay; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
