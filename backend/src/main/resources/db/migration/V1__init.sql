-- Carbon Marketplace schema. ${json} = jsonb on PostgreSQL, text on H2 (dev profile).

create table companies (
    id uuid primary key,
    name varchar(200) not null,
    role varchar(20) not null,
    status varchar(20) not null,
    contact_email varchar(200),
    contact_phone varchar(50),
    address varchar(500),
    city varchar(100),
    state varchar(100),
    country varchar(100),
    latitude double precision,
    longitude double precision,
    sector varchar(40),
    registration_number varchar(100),
    role_profile ${json},
    rejection_reason varchar(500),
    created_at timestamp with time zone not null,
    approved_at timestamp with time zone
);

create table users (
    id uuid primary key,
    company_id uuid not null references companies(id),
    email varchar(200) not null unique,
    password_hash varchar(200) not null,
    full_name varchar(200),
    role varchar(20) not null,
    created_at timestamp with time zone not null
);

create table trust_profiles (
    company_id uuid primary key references companies(id),
    total_agreements integer not null default 0,
    completed_agreements integer not null default 0,
    cancellations_before_expiry integer not null default 0,
    hidden_score double precision not null default 50,
    tier varchar(20) not null default 'SILVER',
    updated_at timestamp with time zone not null
);

create table co2_passports (
    id uuid primary key,
    passport_code varchar(40) not null unique,
    emitter_id uuid not null references companies(id),
    source varchar(200),
    carbon_origin varchar(20),
    capture_technology varchar(200),
    daily_tonnage double precision,
    daily_tonnage_min double precision,
    daily_tonnage_max double precision,
    total_volume_tonnes double precision not null default 0,
    allocated_tonnes double precision not null default 0,
    concentration_pct double precision,
    physical_state varchar(20),
    pressure_bar double precision,
    temperature_c double precision,
    impurities ${json},
    lab_certificate_status varchar(20) not null default 'NONE',
    issuing_lab_id uuid references companies(id),
    coa_issued_at timestamp with time zone,
    coa_expires_at timestamp with time zone,
    capture_timestamp timestamp with time zone,
    meter_id varchar(100),
    location_name varchar(200),
    latitude double precision,
    longitude double precision,
    availability_start date,
    availability_end date,
    pipeline_connected boolean not null default false,
    certifications ${json},
    verification_status varchar(20) not null default 'PENDING',
    mrv_status varchar(20) not null default 'ACTIVE',
    extra_attributes ${json},
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create table listings (
    id uuid primary key,
    passport_id uuid not null references co2_passports(id),
    emitter_id uuid not null references companies(id),
    mode varchar(20) not null,
    status varchar(20) not null,
    volume_tonnes double precision not null,
    base_price_per_tonne double precision not null,
    min_purity_pct double precision,
    delivery_window_start date,
    delivery_window_end date,
    closes_at timestamp with time zone,
    description varchar(2000),
    reserve_price_per_tonne double precision,
    created_at timestamp with time zone not null
);

create table proposals (
    id uuid primary key,
    listing_id uuid not null references listings(id),
    utilizer_id uuid not null references companies(id),
    quantity_tonnes double precision not null,
    required_purity_pct double precision,
    duration_months integer not null default 0,
    delivery_requirement varchar(1000),
    offered_price_per_tonne double precision not null,
    accepts_escrow boolean not null default false,
    other_requirements varchar(2000),
    status varchar(20) not null,
    score double precision,
    score_breakdown ${json},
    created_at timestamp with time zone not null
);

create table negotiations (
    id uuid primary key,
    passport_id uuid not null references co2_passports(id),
    emitter_id uuid not null references companies(id),
    utilizer_id uuid not null references companies(id),
    initiated_by_company_id uuid not null references companies(id),
    status varchar(20) not null,
    agreement_id uuid,
    created_at timestamp with time zone not null
);

create table contract_offers (
    id uuid primary key,
    negotiation_id uuid not null references negotiations(id),
    version integer not null,
    proposed_by_company_id uuid not null references companies(id),
    price_per_tonne double precision not null,
    volume_per_month double precision not null,
    duration_months integer not null,
    pricing_structure varchar(20) not null,
    take_or_pay boolean not null default false,
    supply_gap_threshold_pct double precision,
    deposit_pct double precision,
    message varchar(2000),
    status varchar(20) not null,
    created_at timestamp with time zone not null
);

create table agreements (
    id uuid primary key,
    listing_id uuid references listings(id),
    proposal_id uuid references proposals(id),
    negotiation_id uuid references negotiations(id),
    emitter_id uuid not null references companies(id),
    utilizer_id uuid not null references companies(id),
    passport_id uuid not null references co2_passports(id),
    mode varchar(20) not null,
    volume_tonnes double precision not null,
    price_per_tonne double precision not null,
    status varchar(30) not null,
    cost_stack ${json},
    starts_at date,
    ends_at date,
    duration_months integer,
    volume_per_month double precision,
    deposit_pct double precision,
    take_or_pay boolean not null default false,
    supply_gap_threshold_pct double precision,
    pricing_structure varchar(20),
    cancelled_by_company_id uuid,
    cancel_reason varchar(1000),
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create table shipments (
    id uuid primary key,
    agreement_id uuid not null references agreements(id),
    transport_provider_id uuid references companies(id),
    own_transport boolean not null default false,
    transport_mode varchar(20) not null,
    status varchar(20) not null,
    distance_km double precision,
    volume_tonnes double precision not null,
    origin_lat double precision,
    origin_lng double precision,
    dest_lat double precision,
    dest_lng double precision,
    seal_number varchar(100),
    loaded_weight_tonnes double precision,
    load_meter_reading double precision,
    load_sample_purity_pct double precision,
    loaded_at timestamp with time zone,
    delivery_seal_number varchar(100),
    delivered_weight_tonnes double precision,
    delivery_meter_reading double precision,
    delivery_sample_purity_pct double precision,
    delivered_at timestamp with time zone,
    leakage_tolerance_pct double precision not null default 2.0,
    flags ${json},
    transport_cost double precision,
    created_at timestamp with time zone not null
);

create table transport_offers (
    id uuid primary key,
    shipment_id uuid not null references shipments(id),
    provider_id uuid not null references companies(id),
    status varchar(20) not null,
    distance_from_origin_km double precision,
    quoted_price double precision,
    created_at timestamp with time zone not null
);

create table verification_requests (
    id uuid primary key,
    type varchar(30) not null,
    passport_id uuid references co2_passports(id),
    agreement_id uuid references agreements(id),
    lab_id uuid references companies(id),
    priority integer not null default 3,
    status varchar(20) not null,
    claimed_specs ${json},
    measured_specs ${json},
    notes varchar(2000),
    submitted_at timestamp with time zone not null,
    decided_at timestamp with time zone
);

create table output_forecasts (
    id uuid primary key,
    passport_id uuid not null references co2_passports(id),
    period_start date not null,
    period_end date not null,
    expected_tonnes_per_day double precision not null,
    reason varchar(1000),
    created_at timestamp with time zone not null
);

create table notifications (
    id uuid primary key,
    company_id uuid not null references companies(id),
    type varchar(40) not null,
    title varchar(200) not null,
    message varchar(4000),
    reference_type varchar(40),
    reference_id varchar(80),
    is_read boolean not null default false,
    created_at timestamp with time zone not null
);

create table audit_events (
    id bigint generated by default as identity primary key,
    occurred_at timestamp with time zone not null,
    actor_company_id uuid,
    actor_role varchar(20),
    action varchar(80) not null,
    entity_type varchar(40) not null,
    entity_id varchar(80),
    details ${json},
    previous_hash varchar(64),
    hash varchar(64) not null
);

create index idx_listings_status on listings(status);
create index idx_listings_passport on listings(passport_id);
create index idx_proposals_listing on proposals(listing_id);
create index idx_agreements_emitter on agreements(emitter_id);
create index idx_agreements_utilizer on agreements(utilizer_id);
create index idx_notifications_company on notifications(company_id, is_read);
create index idx_shipments_agreement on shipments(agreement_id);
create index idx_transport_offers_provider on transport_offers(provider_id, status);
create index idx_verification_status on verification_requests(status, priority);
