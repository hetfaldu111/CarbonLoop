-- v2 trading flows: profit-optimal multi-award tenders and scheduled live auctions.
-- Portable SQL only: every statement runs on PostgreSQL 16 and on H2 in PostgreSQL mode.

-- ---- Tender: optional delivery schedule attached to the tender agreement policy ----
alter table listings add column delivery_months integer;
alter table listings add column monthly_tonnes double precision;

-- ---- Auction: scheduling and live state ----
alter table listings add column bid_increment double precision;
alter table listings add column scheduled_start_at timestamp with time zone;
alter table listings add column duration_minutes integer;
alter table listings add column current_price_per_tonne double precision;
alter table listings add column current_leader_id uuid references companies(id);

-- ---- Auction bids ----
create table auction_bids (
    id uuid primary key,
    listing_id uuid not null references listings(id),
    utilizer_id uuid not null references companies(id),
    amount_per_tonne double precision not null,
    total_amount double precision not null,
    binding_accepted boolean not null default false,
    binding_terms varchar(1000),
    placed_at timestamp with time zone not null
);

create index idx_auction_bids_listing on auction_bids(listing_id, placed_at);
create index idx_auction_bids_utilizer on auction_bids(utilizer_id);
create index idx_listings_auction_schedule on listings(mode, status, scheduled_start_at);

-- ---- Emitter badge: cumulative tonnes sold ----
alter table trust_profiles add column tonnes_sold double precision not null default 0;
