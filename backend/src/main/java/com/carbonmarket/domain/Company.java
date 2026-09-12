package com.carbonmarket.domain;

import com.carbonmarket.common.JsonMapConverter;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "companies")
public class Company {
    @Id private UUID id = UUID.randomUUID();
    private String name;
    @Enumerated(EnumType.STRING) private Role role;
    @Enumerated(EnumType.STRING) private CompanyStatus status = CompanyStatus.PENDING;
    private String contactEmail;
    private String contactPhone;
    private String address;
    private String city;
    private String state;
    private String country;
    private Double latitude;
    private Double longitude;
    @Enumerated(EnumType.STRING) private Sector sector;
    private String registrationNumber;
    @Convert(converter = JsonMapConverter.class) private Map<String, Object> roleProfile = new LinkedHashMap<>();
    private String rejectionReason;
    private Instant createdAt = Instant.now();
    private Instant approvedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public CompanyStatus getStatus() { return status; }
    public void setStatus(CompanyStatus status) { this.status = status; }
    public String getContactEmail() { return contactEmail; }
    public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }
    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public Sector getSector() { return sector; }
    public void setSector(Sector sector) { this.sector = sector; }
    public String getRegistrationNumber() { return registrationNumber; }
    public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }
    public Map<String, Object> getRoleProfile() { return roleProfile; }
    public void setRoleProfile(Map<String, Object> roleProfile) { this.roleProfile = roleProfile; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getApprovedAt() { return approvedAt; }
    public void setApprovedAt(Instant approvedAt) { this.approvedAt = approvedAt; }
}
