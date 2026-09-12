# CarbonLoop — Carbon Capture-to-Product Matchmaking Platform

Hackout '26 (DA-IICT) · Theme: Circular Carbon Ecosystem

A marketplace where industrial CO2 emitters (cement, steel, power) list captured CO2 as a **CO2 Passport** and carbon-utilizing industries (fuel synthesis, building materials, greenhouses, algae) discover, bid on, or negotiate for supply, with logistics, verification and cost estimation built in.

**Hard constraints honoured:** no AI, no ML, no blockchain. Every ranking, score and price is a deterministic weighted formula with an explainable per-parameter breakdown. See `docs/DESIGN.md` for every formula and API.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Angular 21, TypeScript, standalone components, signals |
| Backend | Java 21, Spring Boot 3.5, Spring Security (JWT), Spring Data JPA, Flyway |
| Database | PostgreSQL 16 (JSONB for Passport extra attributes; row-level locks for volume allocation). H2 profile for laptop demos without Docker |
| Documents | Cloudinary URLs stored on the Passport (certificate links) |

## Run it

### 1. Database
```bash
docker compose up -d          # PostgreSQL 16 on localhost:5432 (db carbonmarket, user/pass carbon/carbon)
```
No Docker? Skip this and run the backend with the `h2` profile below (in-memory DB, same migrations, same seed).

### 2. Backend (port 8080)
```bash
cd backend
./mvnw spring-boot:run                                   # PostgreSQL
./mvnw spring-boot:run -Dspring-boot.run.profiles=h2     # in-memory H2, no Docker needed
./mvnw test                                              # formula unit tests + context test
```
Seed data loads automatically on first start (`app.seed=true`).

### 3. Frontend (port 4200)
```bash
cd frontend
npm install
npm start          # proxies /api -> http://localhost:8080
```
Open http://localhost:4200

**Low-memory alternative.** `ng serve` needs well over a gigabyte and gets killed on a loaded machine. Build once and serve the static output instead, which runs in about 40 MB and behaves identically (same URL, same `/api` proxy, deep links work):
```bash
cd frontend && npm run build && cd ..
node scripts/serve-frontend.mjs        # http://localhost:4200
```
Pair it with the packaged backend rather than Maven to save another few hundred megabytes:
```bash
cd backend && ./mvnw -DskipTests package && cd ..
java -Xmx512m -jar backend/target/backend-0.0.1-SNAPSHOT.jar
```
Rebuild the frontend after editing its source; the static server does not watch files.

## Demo accounts (password for all: `Password123!`)

| Role | Email | Company |
|---|---|---|
| Admin | admin@carbon.local | Carbon Marketplace Admin |
| Emitter | cement@carbon.local | Saurashtra Cement Works (Gujarat) |
| Emitter | steel@carbon.local | Kalinga Steel Plant (Odisha) |
| Emitter | power@carbon.local | Kutch Thermal Power (Gujarat, pipeline-connected) |
| Utilizer | methanol@carbon.local | Gujarat Methanol Synthesis (GOLD tier) |
| Utilizer | greenhouse@carbon.local | Sabarmati Agro Greenhouses (SILVER) |
| Utilizer | algae@carbon.local | Bay of Bengal Algae Farms (DIAMOND) |
| Utilizer | concrete@carbon.local | Carbonated Concrete Co (BRONZE) |
| Transport | gujtrans@carbon.local | Saurashtra Cryo Logistics |
| Transport | odtrans@carbon.local | East Coast Gas Carriers |
| Lab | lab@carbon.local | National CO2 Testing Lab |
| Regulator | regulator@carbon.local | NITI CCUS Oversight Cell |
| Pending signup | newco@carbon.local | Bharat Bio-CO2 Ltd (awaiting admin approval) |

## Suggested demo path (10 minutes)

1. **Public landing** — impact counter, anonymized listings, "how matching works".
2. **Admin** — approve the pending company (Bharat Bio-CO2 Ltd); open the hash-chained audit log.
3. **Emitter (cement)** — dashboard shows Passport CO2-IND-2026-000342 split across Tender / Auction / Contract / free. Open the tender listing (300 t): three proposals ranked with a full score breakdown; the GOLD-tier bidder beats the higher-priced BRONZE bidder because cancellation rate carries the heaviest weight. Award it.
4. **Lab** — the awarded sale appears in the queue as SALE_APPROVAL; approve it. The pending passport 000345 is also queued for COA.
5. **Utilizer (methanol)** — marketplace, open a listing, run the cost estimator (base + purification + transport + lab + platform = total; net carbon benefit shown separately), submit a bid on the auction.
6. **Utilizer notifications** — the forecast shortfall alert from Kutch Thermal Power with alternative suppliers.
7. **Negotiated contract** — open the accepted 12-month contract, download the generated draft agreement.
8. **Transport (East Coast Gas Carriers)** — accept the notified shipment; record loading (seal, weight, meter, purity); as utilizer record delivery; watch the reconciliation flags fire if the seal or weight does not match.
9. **Regulator** — aggregate overview by region/sector/month, compliance flags, incentive eligibility (CCUS VGF 2026, NITI cluster pilot, CBAM export-ready).

## Pricing modes

| Mode | Status in this build |
|---|---|
| Tender / RFQ | Fully built (listing, scored proposals, award, lab approval) |
| Auction | Built (highest-bid-wins with reserve price, price-weighted scoring, emitter confirms) |
| Negotiated contract | Built (direct connect, offer/counter-offer thread with versions, volume schedule, fixed/indexed pricing, SLA gap threshold, deposit, take-or-pay, draft document, renewal) |

## Roadmap (named, not built)
Jurisdiction policy engine · ERP/SCADA integration APIs · insurance/incident workflow · environmental-attribute ownership ledger · full government subsidy automation · storage/buffer fallback · dispute resolution flow · ESG certificate generator.

## Project layout
```
backend/    Spring Boot API (com.carbonmarket.{config,common,domain,repository,scoring,service,web,seed})
frontend/   Angular app (src/app/{core,shared,layout,pages})
docs/       DESIGN.md — the single source of truth for formulas, entities and API
docker-compose.yml
```
