package com.carbonmarket.domain;

import com.carbonmarket.common.JsonStringListConverter;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "shipments")
public class Shipment {
    @Id private UUID id = UUID.randomUUID();
    private UUID agreementId;
    private UUID transportProviderId;
    private boolean ownTransport;
    @Enumerated(EnumType.STRING) private TransportMode transportMode;
    @Enumerated(EnumType.STRING) private ShipmentStatus status = ShipmentStatus.REQUESTED;
    private Double distanceKm;
    private double volumeTonnes;
    private Double originLat;
    private Double originLng;
    private Double destLat;
    private Double destLng;
    private String sealNumber;
    private Double loadedWeightTonnes;
    private Double loadMeterReading;
    private Double loadSamplePurityPct;
    private Instant loadedAt;
    private String deliverySealNumber;
    private Double deliveredWeightTonnes;
    private Double deliveryMeterReading;
    private Double deliverySamplePurityPct;
    private Instant deliveredAt;
    private double leakageTolerancePct = 2.0;
    @Convert(converter = JsonStringListConverter.class) private List<String> flags = new ArrayList<>();
    private Double transportCost;
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getAgreementId() { return agreementId; }
    public void setAgreementId(UUID agreementId) { this.agreementId = agreementId; }
    public UUID getTransportProviderId() { return transportProviderId; }
    public void setTransportProviderId(UUID transportProviderId) { this.transportProviderId = transportProviderId; }
    public boolean isOwnTransport() { return ownTransport; }
    public void setOwnTransport(boolean ownTransport) { this.ownTransport = ownTransport; }
    public TransportMode getTransportMode() { return transportMode; }
    public void setTransportMode(TransportMode transportMode) { this.transportMode = transportMode; }
    public ShipmentStatus getStatus() { return status; }
    public void setStatus(ShipmentStatus status) { this.status = status; }
    public Double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(Double distanceKm) { this.distanceKm = distanceKm; }
    public double getVolumeTonnes() { return volumeTonnes; }
    public void setVolumeTonnes(double volumeTonnes) { this.volumeTonnes = volumeTonnes; }
    public Double getOriginLat() { return originLat; }
    public void setOriginLat(Double originLat) { this.originLat = originLat; }
    public Double getOriginLng() { return originLng; }
    public void setOriginLng(Double originLng) { this.originLng = originLng; }
    public Double getDestLat() { return destLat; }
    public void setDestLat(Double destLat) { this.destLat = destLat; }
    public Double getDestLng() { return destLng; }
    public void setDestLng(Double destLng) { this.destLng = destLng; }
    public String getSealNumber() { return sealNumber; }
    public void setSealNumber(String sealNumber) { this.sealNumber = sealNumber; }
    public Double getLoadedWeightTonnes() { return loadedWeightTonnes; }
    public void setLoadedWeightTonnes(Double loadedWeightTonnes) { this.loadedWeightTonnes = loadedWeightTonnes; }
    public Double getLoadMeterReading() { return loadMeterReading; }
    public void setLoadMeterReading(Double loadMeterReading) { this.loadMeterReading = loadMeterReading; }
    public Double getLoadSamplePurityPct() { return loadSamplePurityPct; }
    public void setLoadSamplePurityPct(Double loadSamplePurityPct) { this.loadSamplePurityPct = loadSamplePurityPct; }
    public Instant getLoadedAt() { return loadedAt; }
    public void setLoadedAt(Instant loadedAt) { this.loadedAt = loadedAt; }
    public String getDeliverySealNumber() { return deliverySealNumber; }
    public void setDeliverySealNumber(String deliverySealNumber) { this.deliverySealNumber = deliverySealNumber; }
    public Double getDeliveredWeightTonnes() { return deliveredWeightTonnes; }
    public void setDeliveredWeightTonnes(Double deliveredWeightTonnes) { this.deliveredWeightTonnes = deliveredWeightTonnes; }
    public Double getDeliveryMeterReading() { return deliveryMeterReading; }
    public void setDeliveryMeterReading(Double deliveryMeterReading) { this.deliveryMeterReading = deliveryMeterReading; }
    public Double getDeliverySamplePurityPct() { return deliverySamplePurityPct; }
    public void setDeliverySamplePurityPct(Double deliverySamplePurityPct) { this.deliverySamplePurityPct = deliverySamplePurityPct; }
    public Instant getDeliveredAt() { return deliveredAt; }
    public void setDeliveredAt(Instant deliveredAt) { this.deliveredAt = deliveredAt; }
    public double getLeakageTolerancePct() { return leakageTolerancePct; }
    public void setLeakageTolerancePct(double leakageTolerancePct) { this.leakageTolerancePct = leakageTolerancePct; }
    public List<String> getFlags() { return flags; }
    public void setFlags(List<String> flags) { this.flags = flags; }
    public Double getTransportCost() { return transportCost; }
    public void setTransportCost(Double transportCost) { this.transportCost = transportCost; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
