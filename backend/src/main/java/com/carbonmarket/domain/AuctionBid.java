package com.carbonmarket.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * One bid in a live ascending auction. The amount is always computed by the server
 * (opening price, then previous price + the listing's fixed increment), never sent by
 * the client. {@code bindingTerms} stores the exact commitment text the bidder accepted,
 * so it can be reproduced verbatim in the agreement document.
 */
@Entity
@Table(name = "auction_bids")
public class AuctionBid {
    @Id private UUID id = UUID.randomUUID();
    private UUID listingId;
    private UUID utilizerId;
    private double amountPerTonne;
    private double totalAmount;
    private boolean bindingAccepted;
    private String bindingTerms;
    private Instant placedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getListingId() { return listingId; }
    public void setListingId(UUID listingId) { this.listingId = listingId; }
    public UUID getUtilizerId() { return utilizerId; }
    public void setUtilizerId(UUID utilizerId) { this.utilizerId = utilizerId; }
    public double getAmountPerTonne() { return amountPerTonne; }
    public void setAmountPerTonne(double amountPerTonne) { this.amountPerTonne = amountPerTonne; }
    public double getTotalAmount() { return totalAmount; }
    public void setTotalAmount(double totalAmount) { this.totalAmount = totalAmount; }
    public boolean isBindingAccepted() { return bindingAccepted; }
    public void setBindingAccepted(boolean bindingAccepted) { this.bindingAccepted = bindingAccepted; }
    public String getBindingTerms() { return bindingTerms; }
    public void setBindingTerms(String bindingTerms) { this.bindingTerms = bindingTerms; }
    public Instant getPlacedAt() { return placedAt; }
    public void setPlacedAt(Instant placedAt) { this.placedAt = placedAt; }
}
