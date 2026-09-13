# Carbon Marketplace — Design Contract (backend + frontend follow this exactly)

Constraint: NO AI / ML / blockchain. All matching, scoring, ranking = deterministic weighted formulas with explainable breakdowns.
Stack: Angular 21 (standalone, signals) + Spring Boot 3.5 (Java 21, no Lombok) + PostgreSQL 16 (JSONB columns; JDBC url uses `?stringtype=unspecified` so JSON text binds to jsonb), H2 profile (`h2`) for no-docker dev where json columns are `text`.
Currency: INR (₹). Units: tonnes (t), km, %.

> **Superseded for Tender and Auction.** The trading flows were rebuilt in
> [`DESIGN-V2-TRADING-FLOWS.md`](DESIGN-V2-TRADING-FLOWS.md). Tenders now support a profit-optimal
> **multi-award** (exact knapsack over proposal revenue, badge breaks ties, unawarded volume
> returns to free stock), and auctions are **scheduled live ascending auctions** with a fixed
> increment per bid, pseudonymous rival bidders, anti-sniping and a binding last-bid-wins close.
> Read that document for the Tender and Auction contract. The Negotiation flow, the CO2 Passport,
> the cost stack, shipments, verification, the regulator view and the audit chain are unchanged
> and still specified below.

## Roles
ADMIN, EMITTER, UTILIZER, TRANSPORT, LAB, REGULATOR. One user per company. Company status: PENDING → APPROVED | REJECTED. Only APPROVED companies can log in (login returns 403 `{"status":403,"message":"Company approval pending"}`; REJECTED → 403 "Company registration rejected").

## Entities (table → key columns)
- companies: id uuid, name, role, status, contact_email, contact_phone, address, city, state, country, latitude, longitude, sector (CEMENT|STEEL|POWER|REFINERY|CHEMICALS|FUEL_SYNTHESIS|BUILDING_MATERIALS|GREENHOUSE|ALGAE|LOGISTICS|LAB|GOVERNMENT|OTHER), registration_number, role_profile (json: role-specific signup fields), rejection_reason, created_at, approved_at
- users: id uuid, company_id, email unique, password_hash, full_name, role, created_at
- trust_profiles: company_id pk, total_agreements, completed_agreements, cancellations_before_expiry, hidden_score numeric, tier (BRONZE|SILVER|GOLD|DIAMOND), updated_at
- co2_passports: id uuid, passport_code (pattern CO2-IND-<year>-<6 digit seq>, e.g. CO2-IND-2026-000342), emitter_id, source, carbon_origin (FOSSIL|PROCESS|BIOGENIC), capture_technology, daily_tonnage, daily_tonnage_min, daily_tonnage_max, total_volume_tonnes, allocated_tonnes, concentration_pct, physical_state (LIQUEFIED|GASEOUS), pressure_bar, temperature_c, impurities (json {"H2O":ppm,"O2":ppm,"NOx":ppm,"SOx":ppm,"H2S":ppm,"CO":ppm,"N2":ppm}), lab_certificate_status (NONE|PENDING|ISSUED|EXPIRED), issuing_lab_id, coa_issued_at, coa_expires_at, capture_timestamp, meter_id, location_name, latitude, longitude, availability_start, availability_end, pipeline_connected bool, certifications (json [{"name","url"}]), verification_status (PENDING|VERIFIED|REJECTED), mrv_status (ACTIVE|INACTIVE), extra_attributes (json), created_at, updated_at
  - free_tonnes = total_volume_tonnes − allocated_tonnes. Every allocation change runs in a transaction holding a PESSIMISTIC_WRITE (SELECT … FOR UPDATE) lock on the passport row. Over-allocation → 409 `{"message":"Insufficient free volume: requested X t, free Y t"}`.
  - Only VERIFIED passports can be listed or put under contract.
- listings: id, passport_id, emitter_id, mode (TENDER|AUCTION|CONTRACT), status (OPEN|AWARDED|CLOSED|CANCELLED), volume_tonnes, base_price_per_tonne, min_purity_pct, delivery_window_start, delivery_window_end, closes_at, description, reserve_price_per_tonne (auction), created_at
  - Creating a listing locks volume_tonnes on the passport. Cancelling releases it. Awarding: awarded proposal quantity stays locked, remainder (volume − awarded qty) is released.
- proposals (tender proposals AND auction bids): id, listing_id, utilizer_id, quantity_tonnes, required_purity_pct, duration_months, delivery_requirement, offered_price_per_tonne, accepts_escrow, other_requirements, status (SUBMITTED|AWARDED|REJECTED|WITHDRAWN), score, score_breakdown (json), created_at. Auction bids must be ≥ reserve_price_per_tonne if set.
- agreements: id, listing_id (nullable for contract), proposal_id (nullable), negotiation_id (nullable), emitter_id, utilizer_id, passport_id, mode, volume_tonnes, price_per_tonne, status (PENDING_VERIFICATION|ACTIVE|COMPLETED|CANCELLED), cost_stack (json), starts_at, ends_at, duration_months, volume_per_month, deposit_pct, take_or_pay, supply_gap_threshold_pct, pricing_structure (FIXED|INDEXED), cancelled_by_company_id, cancel_reason, created_at, updated_at
- negotiations: id, passport_id, emitter_id, utilizer_id, initiated_by_company_id, status (OPEN|ACCEPTED|REJECTED|CANCELLED), agreement_id, created_at
- contract_offers: id, negotiation_id, version int, proposed_by_company_id, price_per_tonne, volume_per_month, duration_months, pricing_structure, take_or_pay, supply_gap_threshold_pct, deposit_pct, message, status (PENDING|ACCEPTED|REJECTED|COUNTERED), created_at
- shipments: id, agreement_id, transport_provider_id (nullable), own_transport bool, transport_mode (PIPELINE|TRUCK|RAIL), status (REQUESTED|ACCEPTED|IN_TRANSIT|DELIVERED|FLAGGED), distance_km, volume_tonnes, origin_lat, origin_lng, dest_lat, dest_lng, seal_number, loaded_weight_tonnes, load_meter_reading, load_sample_purity_pct, loaded_at, delivery_seal_number, delivered_weight_tonnes, delivery_meter_reading, delivery_sample_purity_pct, delivered_at, leakage_tolerance_pct (default 2.0), flags (json [string]), transport_cost, created_at
- transport_offers: id, shipment_id, provider_id, status (NOTIFIED|ACCEPTED|REJECTED|EXPIRED), distance_from_origin_km, quoted_price, created_at
- verification_requests: id, type (PASSPORT_COA|SALE_APPROVAL), passport_id, agreement_id, lab_id (nullable until claimed), priority int (1 low..5 high), status (QUEUED|IN_REVIEW|APPROVED|REJECTED), claimed_specs (json), measured_specs (json), notes, submitted_at, decided_at
- output_forecasts: id, passport_id, period_start, period_end, expected_tonnes_per_day, reason, created_at
- notifications: id, company_id, type, title, message, reference_type, reference_id, read bool, created_at
- audit_events: id bigserial, occurred_at, actor_company_id, actor_role, action, entity_type, entity_id, details (json), previous_hash, hash. hash = sha256(previous_hash + occurred_at + action + entity_type + entity_id + details). Tamper-evident append-only chain in one DB — NOT a blockchain (no distributed ledger / consensus).

## Formulas (package `com.carbonmarket.scoring`)

### Trust / Hidden Score
```
completion_rate = total_agreements == 0 ? 0.5 : completed_agreements / total_agreements
hidden_score    = clamp(completion_rate * 100 − cancellations_before_expiry * 15, 0, 100)
tier: score < 40 BRONZE | 40–69 SILVER | 70–89 GOLD | ≥ 90 DIAMOND
```
Events: agreement created → total+1 for both parties; agreement COMPLETED → completed+1 for both; agreement CANCELLED by a party before ends_at → that party's cancellations+1. Recompute and persist on each event.

### Utilizer Priority Score (0–100), computed when a proposal/bid is submitted
Components normalized to 0–100:
- tierScore: BRONZE 25, SILVER 50, GOLD 75, DIAMOND 100
- hiddenScore: trust hidden_score
- priceScore: clamp(50 + (offered − base)/base × 100, 0, 100)   (offered = base → 50; +50% → 100)
- volumeFitScore: 100 × min(req, listingVolume) / max(req, listingVolume)
- durationScore: clamp(durationMonths / 12 × 100, 0, 100)
- escrowScore: acceptsEscrow ? 100 : 0
- distanceScore: clamp(100 − distanceKm / 10, 0, 100)  (haversine passport location ↔ utilizer company)
- cancellationRate: total == 0 ? 0 : cancellations / total (0–1)

Weights:

| component | TENDER | AUCTION |
|---|---|---|
| tier | 0.20 | 0.10 |
| hidden | 0.15 | 0.10 |
| price | 0.15 | 0.45 |
| volumeFit | 0.15 | 0.10 |
| duration | 0.10 | 0.00 |
| escrow | 0.10 | 0.05 |
| distance | 0.05 | 0.05 |
| cancellationPenalty | 0.30 | 0.25 |

score = clamp( Σ(w × component) − cancellationRate × 100 × w_cancel, 0, 100 )

score_breakdown json:
```
{"mode":"TENDER","total":73.4,
 "components":[
   {"name":"trustTier","rawValue":"GOLD","normalized":75,"weight":0.20,"contribution":15.0,"explanation":"Gold trust tier"},
   ...,
   {"name":"cancellationRate","rawValue":0.1,"normalized":10,"weight":-0.30,"contribution":-3.0,"explanation":"1 of 10 agreements cancelled before expiry"}]}
```
Ranking = score desc, ties by created_at asc. The emitter's proposal list carries `recommendation`: "Recommended: <utilizer> (score X) — <top 2 positive contributions by name>". The emitter always awards manually.

### Cost Stack (POST /api/costs/estimate) — every layer separate
1. baseCost = basePricePerTonne × qty
2. purificationCost: if requiredPurityPct > passport.concentration_pct → (requiredPurity − concentration) × ₹150 per %-point per tonne × qty. Plus for each impurityLimits entry (ppm) where passport level > limit → rate × qty. Rates ₹/t: H2O 80, O2 60, NOx 100, SOx 120, H2S 140, CO 90, N2 70. Return `purificationSteps[{parameter, passportLevel, requiredLevel, ratePerTonne, cost}]`.
3. transportCost = distanceKm × qty × ratePerTonneKm + fixedPerShipment. PIPELINE 0.8 ₹/t·km + 0 (allowed only if passport.pipeline_connected && distance ≤ 100 km, else 400 "PIPELINE_UNAVAILABLE"); RAIL 2.5 + 15000; TRUCK 4.0 + 5000. distance = haversine(passport, utilizer company).
4. verificationCost = ₹12,000 flat per shipment
5. platformFee = `app.platform-fee-pct` (default 0) % of (1+2+3+4)
6. totalDeliveredCost = 1+2+3+4+5; totalPerTonne = total / qty

Separately (never blended into price):
- expectedLeakagePct = base (PIPELINE 0.5, RAIL 1.5, TRUCK 2.0) + 0.1 × (distanceKm / 100)
- effectiveDeliveredTonnes = qty × (1 − leakage/100)
- transportEmissionsTonnes = qty × distanceKm × factor / 1000, factor kgCO2/t·km: TRUCK 0.062, RAIL 0.022, PIPELINE 0.005
- netCarbonBenefitTonnes = effectiveDeliveredTonnes − transportEmissionsTonnes

Response:
```
{ "listingId","quantityTonnes","distanceKm","transportMode",
  "layers":[{"name":"Base CO2 cost","amount":..,"perTonne":..,"detail":".."},{"name":"Purification / conditioning",..},{"name":"Transportation",..},{"name":"Verification / lab",..},{"name":"Platform fee",..}],
  "purificationSteps":[...], "totalDeliveredCost", "totalPerTonne",
  "carbon":{"grossTonnes","expectedLeakagePct","leakageLossTonnes","effectiveDeliveredTonnes","transportEmissionsTonnes","netCarbonBenefitTonnes"} }
```

### Shipment reconciliation (on deliver)
flags: SEAL_MISMATCH if delivery_seal != seal; WEIGHT_GAP if (loaded−delivered)/loaded×100 > leakage_tolerance_pct; PURITY_DRIFT if |load purity − delivery purity| > 0.5; METER_MISMATCH if |(load_meter − delivery_meter)| differs from loaded_weight by > 2%. Any flag → status FLAGGED + notifications to emitter, utilizer, all LAB companies; else DELIVERED.

### Forecast shortfall
POST forecast with expected_tonnes_per_day < passport.daily_tonnage → for every utilizer with an ACTIVE agreement on that passport whose window overlaps the period: notification type FORECAST_SHORTFALL, message includes shortfall % and up to 3 alternative OPEN listings (other emitters, min_purity ≥ agreement passport concentration − 2, ranked by price asc then distance asc), formatted "Alternatives: <emitter city/state> <volume> t @ ₹<price>/t; …". Also notifies emitter itself.

### COA expiry
Scheduled job (every hour) + on startup: passports with coa_expires_at < now → lab_certificate_status EXPIRED, verification_status PENDING, new PASSPORT_COA request priority 5, notification to emitter. Listing creation on such a passport is rejected.

### Regulator incentive flags (rule-based)
- CCUS_VGF_2026: company.sector ∈ {POWER,STEEL,CEMENT,REFINERY,CHEMICALS} AND ≥1 VERIFIED passport AND ≥1 ACTIVE/COMPLETED agreement
- NITI_CLUSTER_PILOT: company.state ∈ {Gujarat, Odisha}
- CBAM_EXPORT_READY: company party to ≥1 CONTRACT-mode agreement with duration_months ≥ 6
Compliance flags: COA_EXPIRED (any passport EXPIRED), HIGH_CANCELLATION (cancellationRate > 0.2), FLAGGED_SHIPMENTS (count > 0), PENDING_VERIFICATION (any passport PENDING).

## REST API (prefix /api, JSON, `Authorization: Bearer <jwt>`; errors `{ "status", "message", "timestamp" }`)
Auth
- POST /auth/register {role, companyName, email, password, fullName, contactPhone, address, city, state, country, latitude, longitude, sector, registrationNumber, roleProfile{}} → 201 {companyId, status:"PENDING"}
- POST /auth/login {email, password} → {token, user:{id,email,fullName,role,companyId,companyName,companyStatus}}
- GET /auth/me → user object
Public (no auth)
- GET /public/impact → {totalCo2DivertedTonnes, tonnesUnderContract, activeClusters, verifiedPassports, activeListings, completedAgreements, byRegion:[{region, tonnes}], bySector:[{sector, tonnes}]}
- GET /public/listings → [{id, mode, volumeTonnes, minPurityPct, concentrationPct, physicalState, city, state, basePricePerTonne, closesAt}] (no company names)
Admin (ADMIN)
- GET /admin/companies?status= → CompanyDto[] ; POST /admin/companies/{id}/approve ; POST /admin/companies/{id}/reject {reason}
Companies (any authenticated)
- GET /companies/me → CompanyDto ; GET /companies/me/trust → TrustDto{companyId, companyName, tier, hiddenScore, totalAgreements, completedAgreements, cancellationsBeforeExpiry, cancellationRate, completionRate, formula}
- PUT /companies/me → CompanyDto. Body UpdateProfileRequest{contactPhone, address, city, state, country, latitude, longitude, roleProfile?}. Self-service profile edit. Name, role, sector, registration number and status are deliberately absent: an admin verified those at approval, so a company must not be able to become something different from what was approved. Records a PROFILE_UPDATED audit event carrying a `relocated` flag, because moving the coordinates re-prices every delivered-cost quote that starts from this site.
- GET /companies/{id}/trust ; GET /companies/directory?role=EMITTER|UTILIZER → [{id,name,city,state,sector,tier}] (approved only)
Passports (EMITTER)
- GET /passports ; POST /passports (all passport fields; verification_status PENDING; creates PASSPORT_COA verification request priority 3; passport_code auto-generated) ; GET /passports/{id} ; PUT /passports/{id} (editable while PENDING or if no allocation) ; GET /passports/{id}/allocation → {passportId, passportCode, totalVolumeTonnes, allocatedTonnes, allocatedTender, allocatedAuction, allocatedContract, freeTonnes, listings:[{listingId, mode, status, volumeTonnes}], agreements:[{agreementId, mode, status, volumeTonnes}]}
- POST /passports/{id}/forecasts {periodStart, periodEnd, expectedTonnesPerDay, reason} ; GET /passports/{id}/forecasts
- GET /passports/{id}/public → PassportPublicDto (any authenticated; used by listing detail; hides total volume & meter id)
Listings
- POST /listings {passportId, mode, volumeTonnes, basePricePerTonne, minPurityPct, deliveryWindowStart, deliveryWindowEnd, closesAt, description, reservePricePerTonne} (EMITTER)
- GET /listings?mode=&status=&minPurity=&state= (any authenticated; default status OPEN) → ListingDto{id, passportId, passportCode, mode, status, volumeTonnes, basePricePerTonne, minPurityPct, concentrationPct, physicalState, carbonOrigin, captureTechnology, city, state, latitude, longitude, pipelineConnected, deliveryWindowStart, deliveryWindowEnd, closesAt, description, reservePricePerTonne, emitterId, emitterName, emitterTier, passportTotalVolume, proposalCount, createdAt}. Privacy: emitterName, emitterId, passportTotalVolume are null unless caller is the emitter, an ADMIN/REGULATOR/LAB, or has a proposal on it.
- GET /listings/mine (EMITTER) ; GET /listings/{id} ; POST /listings/{id}/cancel (EMITTER, only OPEN)
- POST /listings/{id}/proposals {quantityTonnes, requiredPurityPct, durationMonths, deliveryRequirement, offeredPricePerTonne, acceptsEscrow, otherRequirements} (UTILIZER) → ProposalDto{id, listingId, listingMode, utilizerId, utilizerName, utilizerTier, quantityTonnes, requiredPurityPct, durationMonths, deliveryRequirement, offeredPricePerTonne, acceptsEscrow, otherRequirements, status, score, scoreBreakdown, rank, createdAt}. One SUBMITTED proposal per utilizer per listing (409 otherwise).
- GET /listings/{id}/proposals → emitter/admin/regulator: ranked list + `recommendation` string on each response element `rank`=1..n; utilizer: own only
- POST /listings/{id}/award {proposalIds:[...]} (EMITTER) → AgreementDto[] — one agreement per winner. See DESIGN-V2-TRADING-FLOWS.md §1.3. Also GET /listings/{id}/award-suggestion for the profit-optimal combination.
Proposals (UTILIZER)
- GET /proposals/mine ; POST /proposals/{id}/withdraw
Costs (any authenticated; utilizer coords from caller company, or `destinationLatitude/Longitude` override)
- POST /costs/estimate {listingId, quantityTonnes, requiredPurityPct, transportMode, impurityLimits:{"SOx":50,…}} → CostEstimateDto
Agreements
- GET /agreements (EMITTER/UTILIZER own; others all) → AgreementDto{id, mode, status, listingId, proposalId, negotiationId, passportId, passportCode, emitterId, emitterName, utilizerId, utilizerName, volumeTonnes, pricePerTonne, totalValue, startsAt, endsAt, durationMonths, volumePerMonth, depositPct, takeOrPay, supplyGapThresholdPct, pricingStructure, costStack, cancelReason, cancelledByCompanyId, createdAt}
- GET /agreements/{id} ; POST /agreements/{id}/cancel {reason} (party) ; POST /agreements/{id}/complete (party, ACTIVE only) ; GET /agreements/{id}/document → text/markdown draft contract ; POST /agreements/{id}/renew (CONTRACT: opens a new negotiation pre-filled from the agreement)
Negotiations (CONTRACT mode; EMITTER or UTILIZER)
- POST /negotiations {counterpartyCompanyId, passportId, offer:{pricePerTonne, volumePerMonth, durationMonths, pricingStructure, takeOrPay, supplyGapThresholdPct, depositPct, message}} → NegotiationDto{id, passportId, passportCode, emitterId, emitterName, utilizerId, utilizerName, initiatedByCompanyId, status, agreementId, offers:[ContractOfferDto{id, version, proposedByCompanyId, proposedByName, pricePerTonne, volumePerMonth, durationMonths, pricingStructure, takeOrPay, supplyGapThresholdPct, depositPct, message, status, createdAt}], createdAt}
- GET /negotiations ; GET /negotiations/{id} ; POST /negotiations/{id}/offers (counter: previous PENDING → COUNTERED) ; POST /negotiations/{id}/offers/{offerId}/accept (only the non-proposer; creates CONTRACT agreement ACTIVE, locks volumePerMonth × durationMonths on passport; negotiation ACCEPTED) ; POST /negotiations/{id}/offers/{offerId}/reject (negotiation REJECTED)
Shipments
- POST /agreements/{id}/shipments {transportMode, ownTransport, volumeTonnes} (party, agreement ACTIVE) → ShipmentDto{id, agreementId, passportCode, emitterName, utilizerName, transportProviderId, transportProviderName, ownTransport, transportMode, status, distanceKm, volumeTonnes, sealNumber, loadedWeightTonnes, loadMeterReading, loadSamplePurityPct, loadedAt, deliverySealNumber, deliveredWeightTonnes, deliveryMeterReading, deliverySamplePurityPct, deliveredAt, leakageTolerancePct, flags, transportCost, createdAt}. If !ownTransport: transport_offers NOTIFIED for TRANSPORT companies within 100 km of passport location (fallback: all TRANSPORT companies, flag "NO_PROVIDER_IN_RANGE").
- GET /shipments (EMITTER/UTILIZER: own agreements; TRANSPORT: assigned; LAB/ADMIN/REGULATOR: all) ; GET /shipments/{id}
- GET /shipments/offers (TRANSPORT: own offers) → TransportOfferDto{id, shipmentId, shipment (ShipmentDto), status, distanceFromOriginKm, quotedPrice, createdAt} ; POST /shipments/offers/{offerId}/accept {quotedPrice} (first accept wins → shipment ACCEPTED, siblings EXPIRED) ; POST /shipments/offers/{offerId}/reject
- POST /shipments/{id}/load {sealNumber, loadedWeightTonnes, meterReading, samplePurityPct} (emitter or assigned transport) → IN_TRANSIT ; POST /shipments/{id}/deliver {sealNumber, deliveredWeightTonnes, meterReading, samplePurityPct} (utilizer or assigned transport) → DELIVERED | FLAGGED
Verification (LAB)
- GET /verification/queue (QUEUED + IN_REVIEW; priority desc, submitted asc) → VerificationRequestDto{id, type, priority, status, passportId, passportCode, emitterName, agreementId, labId, claimedSpecs, measuredSpecs, notes, submittedAt, decidedAt}
- GET /verification/{id} ; POST /verification/{id}/claim ; POST /verification/{id}/decide {approved, measuredSpecs:{concentrationPct, impurities{}}, notes, coaValidMonths}
  - PASSPORT_COA approve → passport VERIFIED, lab_certificate_status ISSUED, coa dates set; reject → passport REJECTED
  - SALE_APPROVAL approve → agreement ACTIVE; reject → agreement CANCELLED (no trust penalty), volume released
- GET /verification/expiring (COAs expiring within 30 days) ; GET /verification/history (decided)
Regulator (REGULATOR; ADMIN also allowed)
- GET /regulator/overview → {totals:{capturedTonnes, listedTonnes, tradedTonnes, utilizedTonnes}, byRegion:[{region, captured, traded}], bySector:[{sector, captured, traded}], byMonth:[{month:"2026-09", traded, utilized}], flaggedShipments, expiredCoas}
- GET /regulator/companies → [{id, name, role, sector, city, state, status, tier, hiddenScore, complianceFlags[], incentiveFlags[], verifiedPassports, totalAgreements, flaggedShipments}]
- GET /regulator/companies/{id} → {company, trust, passports[], verificationRequests[], agreements[], shipments[], complianceFlags[], incentiveFlags[]}
Notifications (any): GET /notifications ; POST /notifications/{id}/read ; POST /notifications/read-all ; GET /notifications/unread-count → {count}
Audit (ADMIN|LAB|REGULATOR): GET /audit?page=0&size=50 → {content:[AuditEventDto{id, occurredAt, actorCompanyId, actorName, actorRole, action, entityType, entityId, details, previousHash, hash}], totalElements, totalPages, number}
Config: GET /meta/rates (any) → the rate tables + weight tables used by the formulas (frontend shows "how it is calculated").

## Seed data (property `app.seed=true`, idempotent — skip if admin exists). Password for every account: `Password123!`
- admin@carbon.local ADMIN "Carbon Marketplace Admin"
- emitters: cement@carbon.local "Saurashtra Cement Works" (CEMENT, Porbandar, Gujarat, 21.64,69.61); steel@carbon.local "Kalinga Steel Plant" (STEEL, Angul, Odisha, 20.84,85.10); power@carbon.local "Kutch Thermal Power" (POWER, Mundra, Gujarat, 22.84,69.72)
- utilizers: methanol@carbon.local "Gujarat Methanol Synthesis" (FUEL_SYNTHESIS, Dahej, Gujarat, 21.70,72.57); greenhouse@carbon.local "Sabarmati Agro Greenhouses" (GREENHOUSE, Ahmedabad, Gujarat, 23.02,72.57); algae@carbon.local "Bay of Bengal Algae Farms" (ALGAE, Paradip, Odisha, 20.32,86.61); concrete@carbon.local "Carbonated Concrete Co" (BUILDING_MATERIALS, Rajkot, Gujarat, 22.30,70.80)
- transport: gujtrans@carbon.local "Saurashtra Cryo Logistics" (LOGISTICS, Jamnagar, Gujarat, 22.47,70.06); odtrans@carbon.local "East Coast Gas Carriers" (LOGISTICS, Cuttack, Odisha, 20.46,85.88)
- lab: lab@carbon.local "National CO2 Testing Lab" (LAB, Vadodara, Gujarat, 22.31,73.18)
- regulator: regulator@carbon.local "NITI CCUS Oversight Cell" (GOVERNMENT, New Delhi, Delhi, 28.61,77.21)
- pending (unapproved): newco@carbon.local "Bharat Bio-CO2 Ltd" (EMITTER, PENDING, Surat, Gujarat)
- Passports: CO2-IND-2026-000342 (cement kiln flue gas, PROCESS, amine capture, 22 t/d range 18–25, total 600 t, 96.8%, LIQUEFIED, 18 bar, −25°C, impurities H2O 30 O2 120 NOx 15 SOx 8 H2S 2 CO 10 N2 4000, VERIFIED, COA ISSUED valid 6 months, meter MTR-PBR-01, pipeline_connected false); CO2-IND-2026-000343 (steel blast-furnace gas, FOSSIL, PSA capture, 40 t/d, 900 t, 94.5%, GASEOUS, 8 bar, 20°C, VERIFIED); CO2-IND-2026-000344 (power flue gas, FOSSIL, amine capture, 60 t/d, 1500 t, 98.2%, LIQUEFIED, 20 bar, −20°C, VERIFIED, pipeline_connected true); CO2-IND-2026-000345 (cement, 15 t/d, 300 t, 95.1%, PENDING verification → in lab queue)
- Trust: methanol GOLD (10 total / 9 completed / 0 cancels), greenhouse SILVER (4/3/1), algae DIAMOND (12/12/0), concrete BRONZE (5/2/2); emitters: cement 8/8/0, steel 6/5/0, power 5/5/0
- Listings: L1 TENDER on 000342 300 t @ ₹4,200 (OPEN, 3 proposals: methanol 250 t @4300 12 mo escrow yes; greenhouse 100 t @4000 6 mo escrow no; concrete 300 t @4600 3 mo escrow no); L2 AUCTION on 000342 50 t @ ₹5,000 reserve (OPEN, bids: greenhouse 50 t @5200; concrete 50 t @5600); L3 TENDER on 000344 800 t @ ₹3,800 (OPEN, 1 proposal from algae 600 t @3900 12 mo escrow yes); L4 TENDER on 000343 400 t (AWARDED → agreement ACTIVE with algae, 350 t @ ₹3,500, one shipment DELIVERED (truck, seal SEAL-7781, 35 t loaded / 34.6 delivered) and one shipment REQUESTED with transport offers NOTIFIED to East Coast Gas Carriers)
- One CONTRACT agreement (negotiation accepted, 2 offer versions) between Kutch Thermal Power and Gujarat Methanol: 40 t/month × 12 months @ ₹3,600 FIXED, deposit 10%, take-or-pay, gap threshold 10%, ACTIVE (locks 480 t on 000344)
- One COMPLETED agreement (history) between cement & methanol 200 t @ ₹4,100 (listing CLOSED)
- One forecast on 000344: maintenance starting 1 month from now for 10 days, 30 t/d (50% shortfall) → FORECAST_SHORTFALL notification to methanol
- Verification queue: 000345 PASSPORT_COA QUEUED; SALE_APPROVAL for a PENDING_VERIFICATION agreement (L2-independent: award of a small tender L5 on 000342 100 t to greenhouse @4,050)
- Audit events for all of the above, hash-chained.

## Implementation notes (recorded after the build — these override the text above where they conflict)
- **Score ceiling.** Positive weights sum to 0.90 (TENDER) and 0.85 (AUCTION), so a flawless proposal scores 90 / 85, not 100. Weights were kept exactly as specified; the headline reads "X / 100".
- **Completion consumes stock.** Completing an agreement decrements both `allocated_tonnes` and `total_volume_tonnes`, so a Passport's total is remaining stock, not lifetime capture. The seeded 600 t on CO2-IND-2026-000342 is what is left after the completed 200 t deal.
- **Trust seed.** Gujarat Methanol Synthesis is seeded 10 total / 8 completed / 0 cancellations (hidden score 80 = GOLD). The 10/9/0 written earlier would score 90 and land in DIAMOND, which breaks the intended tier spread across the four utilizers.
- **Extra endpoint.** `GET /api/audit/verify` recomputes the hash chain and reports whether it is intact. Useful in the demo to show the audit log is tamper-evident.
- **Reserved word.** `notifications.read` is stored as column `is_read`; the entity property and the DTO field are both still `read`.
- **JSON columns.** Mapped as `Map`/`List` through attribute converters over text/jsonb, so the one migration runs unchanged on PostgreSQL and on H2 in PostgreSQL mode.
- **Audit hashing is canonical.** The chain digest covers a canonical rendering of `details` (object keys sorted, numbers normalised) rather than the raw serialisation. PostgreSQL's jsonb reorders keys and reformats numbers on read, so hashing the raw JSON reported a false tamper on every event with a non-trivial payload. Verified on PostgreSQL: chain intact across the seed, and editing one row's `details` directly in the database is still detected and names the exact row.
- **Verified on real PostgreSQL 16.** Migration applies, all ten jsonb columns are genuinely `jsonb`, the seed loads, the 29-check smoke suite and the browser sweep pass, and six concurrent 100 t allocations against 150 t of free volume produced exactly one 201 and five 409s with no overselling.

## Frontend routes (role-guarded; layout with sidebar per role, notification bell with unread count)
/ (public landing: impact counter + anonymized listings + "how matching works" explanation), /login, /register (role picker → role-specific fields)
/admin (pending approvals), /admin/companies, /admin/audit
/emitter (dashboard: capacity allocation across all passports), /emitter/passports, /emitter/passports/new, /emitter/passports/:id (detail + allocation bar + forecasts), /emitter/listings, /emitter/listings/new, /emitter/listings/:id (ranked proposals with breakdown + award), /emitter/agreements, /emitter/negotiations, /emitter/negotiations/:id, /emitter/shipments
/utilizer (dashboard), /utilizer/marketplace, /utilizer/listings/:id (detail + cost estimator + proposal/bid form), /utilizer/proposals, /utilizer/agreements, /utilizer/negotiations, /utilizer/negotiations/:id, /utilizer/shipments, /utilizer/trust
/transport (offers), /transport/shipments
/lab (queue), /lab/requests/:id, /lab/history
/regulator (overview), /regulator/companies, /regulator/companies/:id, /regulator/audit
/notifications (all roles), /agreements/:id (shared detail with cost stack, document download, shipments, cancel/complete), /shipments/:id (shared detail with load/deliver forms based on role)
Dev: Angular `proxy.conf.json` maps `/api` → http://localhost:8080. Frontend port 4200, backend 8080.
