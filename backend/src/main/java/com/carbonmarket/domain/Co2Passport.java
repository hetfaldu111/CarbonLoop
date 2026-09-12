package com.carbonmarket.domain;

import com.carbonmarket.common.JsonListConverter;
import com.carbonmarket.common.JsonMapConverter;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Entity
@Table(name = "co2_passports")
public class Co2Passport {
    @Id private UUID id = UUID.randomUUID();
    private String passportCode;
    private UUID emitterId;
    private String source;
    @Enumerated(EnumType.STRING) private CarbonOrigin carbonOrigin;
    private String captureTechnology;
    private Double dailyTonnage;
    private Double dailyTonnageMin;
    private Double dailyTonnageMax;
    private double totalVolumeTonnes;
    private double allocatedTonnes;
    private Double concentrationPct;
    @Enumerated(EnumType.STRING) private PhysicalState physicalState;
    private Double pressureBar;
    @Column(name = "temperature_c") private Double temperatureC;
    @Convert(converter = JsonMapConverter.class) private Map<String, Object> impurities = new LinkedHashMap<>();
    @Enumerated(EnumType.STRING) private LabCertificateStatus labCertificateStatus = LabCertificateStatus.NONE;
    private UUID issuingLabId;
    private Instant coaIssuedAt;
    private Instant coaExpiresAt;
    private Instant captureTimestamp;
    private String meterId;
    private String locationName;
    private Double latitude;
    private Double longitude;
    private LocalDate availabilityStart;
    private LocalDate availabilityEnd;
    private boolean pipelineConnected;
    @Convert(converter = JsonListConverter.class) private List<Map<String, Object>> certifications = new ArrayList<>();
    @Enumerated(EnumType.STRING) private VerificationStatus verificationStatus = VerificationStatus.PENDING;
    @Enumerated(EnumType.STRING) private MrvStatus mrvStatus = MrvStatus.ACTIVE;
    @Convert(converter = JsonMapConverter.class) private Map<String, Object> extraAttributes = new LinkedHashMap<>();
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    public double freeTonnes() { return Math.max(0, totalVolumeTonnes - allocatedTonnes); }

    /** Impurity level in ppm for a parameter key such as "SOx"; 0 if absent. */
    public double impurity(String key) {
        Object v = impurities == null ? null : impurities.get(key);
        return v instanceof Number n ? n.doubleValue() : 0;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getPassportCode() { return passportCode; }
    public void setPassportCode(String passportCode) { this.passportCode = passportCode; }
    public UUID getEmitterId() { return emitterId; }
    public void setEmitterId(UUID emitterId) { this.emitterId = emitterId; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public CarbonOrigin getCarbonOrigin() { return carbonOrigin; }
    public void setCarbonOrigin(CarbonOrigin carbonOrigin) { this.carbonOrigin = carbonOrigin; }
    public String getCaptureTechnology() { return captureTechnology; }
    public void setCaptureTechnology(String captureTechnology) { this.captureTechnology = captureTechnology; }
    public Double getDailyTonnage() { return dailyTonnage; }
    public void setDailyTonnage(Double dailyTonnage) { this.dailyTonnage = dailyTonnage; }
    public Double getDailyTonnageMin() { return dailyTonnageMin; }
    public void setDailyTonnageMin(Double dailyTonnageMin) { this.dailyTonnageMin = dailyTonnageMin; }
    public Double getDailyTonnageMax() { return dailyTonnageMax; }
    public void setDailyTonnageMax(Double dailyTonnageMax) { this.dailyTonnageMax = dailyTonnageMax; }
    public double getTotalVolumeTonnes() { return totalVolumeTonnes; }
    public void setTotalVolumeTonnes(double totalVolumeTonnes) { this.totalVolumeTonnes = totalVolumeTonnes; }
    public double getAllocatedTonnes() { return allocatedTonnes; }
    public void setAllocatedTonnes(double allocatedTonnes) { this.allocatedTonnes = allocatedTonnes; }
    public Double getConcentrationPct() { return concentrationPct; }
    public void setConcentrationPct(Double concentrationPct) { this.concentrationPct = concentrationPct; }
    public PhysicalState getPhysicalState() { return physicalState; }
    public void setPhysicalState(PhysicalState physicalState) { this.physicalState = physicalState; }
    public Double getPressureBar() { return pressureBar; }
    public void setPressureBar(Double pressureBar) { this.pressureBar = pressureBar; }
    public Double getTemperatureC() { return temperatureC; }
    public void setTemperatureC(Double temperatureC) { this.temperatureC = temperatureC; }
    public Map<String, Object> getImpurities() { return impurities; }
    public void setImpurities(Map<String, Object> impurities) { this.impurities = impurities; }
    public LabCertificateStatus getLabCertificateStatus() { return labCertificateStatus; }
    public void setLabCertificateStatus(LabCertificateStatus labCertificateStatus) { this.labCertificateStatus = labCertificateStatus; }
    public UUID getIssuingLabId() { return issuingLabId; }
    public void setIssuingLabId(UUID issuingLabId) { this.issuingLabId = issuingLabId; }
    public Instant getCoaIssuedAt() { return coaIssuedAt; }
    public void setCoaIssuedAt(Instant coaIssuedAt) { this.coaIssuedAt = coaIssuedAt; }
    public Instant getCoaExpiresAt() { return coaExpiresAt; }
    public void setCoaExpiresAt(Instant coaExpiresAt) { this.coaExpiresAt = coaExpiresAt; }
    public Instant getCaptureTimestamp() { return captureTimestamp; }
    public void setCaptureTimestamp(Instant captureTimestamp) { this.captureTimestamp = captureTimestamp; }
    public String getMeterId() { return meterId; }
    public void setMeterId(String meterId) { this.meterId = meterId; }
    public String getLocationName() { return locationName; }
    public void setLocationName(String locationName) { this.locationName = locationName; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public LocalDate getAvailabilityStart() { return availabilityStart; }
    public void setAvailabilityStart(LocalDate availabilityStart) { this.availabilityStart = availabilityStart; }
    public LocalDate getAvailabilityEnd() { return availabilityEnd; }
    public void setAvailabilityEnd(LocalDate availabilityEnd) { this.availabilityEnd = availabilityEnd; }
    public boolean isPipelineConnected() { return pipelineConnected; }
    public void setPipelineConnected(boolean pipelineConnected) { this.pipelineConnected = pipelineConnected; }
    public List<Map<String, Object>> getCertifications() { return certifications; }
    public void setCertifications(List<Map<String, Object>> certifications) { this.certifications = certifications; }
    public VerificationStatus getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(VerificationStatus verificationStatus) { this.verificationStatus = verificationStatus; }
    public MrvStatus getMrvStatus() { return mrvStatus; }
    public void setMrvStatus(MrvStatus mrvStatus) { this.mrvStatus = mrvStatus; }
    public Map<String, Object> getExtraAttributes() { return extraAttributes; }
    public void setExtraAttributes(Map<String, Object> extraAttributes) { this.extraAttributes = extraAttributes; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
