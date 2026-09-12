package com.carbonmarket.domain;

/**
 * Tenders use OPEN → AWARDED / CLOSED / CANCELLED.
 * Auctions use SCHEDULED → LIVE → ENDED (then AWARDED once the winning agreement exists,
 * or CLOSED when the auction attracted no bids). CANCELLED applies to both.
 */
public enum ListingStatus {
    OPEN, AWARDED, CLOSED, CANCELLED, SCHEDULED, LIVE, ENDED;

    /** Statuses a buyer can still act on: tenders taking proposals, auctions announced or running. */
    public boolean isActive() { return this == OPEN || this == SCHEDULED || this == LIVE; }
}
