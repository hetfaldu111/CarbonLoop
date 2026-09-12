# Design v2 — the three emitter↔utilizer trading flows

Supersedes the Tender and Auction sections of `DESIGN.md`. Negotiation is unchanged.
Constraint unchanged: **no AI, no ML, no blockchain.** Every suggestion is a deterministic,
explainable calculation. The optimiser below is exact dynamic programming, not a heuristic
and not a model.

---

## 0. Stock split (already built, stated here for completeness)

An emitter's Passport holds a total volume. The emitter allocates slices of it:

```
total 1400 t  =  tender 1000 t  +  auction 100 t  +  contract 0 t  +  free 300 t
```

`free` stays available for future trades. Every allocation and release happens inside a
transaction holding a `PESSIMISTIC_WRITE` lock on the passport row, so the same tonne can
never be committed twice. Unsold tonnes always return to `free`.

---

## 1. Tender flow

### 1.1 Emitter publishes
Unchanged fields: passport, volume, `basePricePerTonne`, `minPurityPct`, delivery window,
`closesAt` (last date a utilizer may apply), description.

Delivery schedule (new, optional, describes the agreement policy attached to the tender):
- `deliveryMonths` int — e.g. 6
- `monthlyTonnes` double — e.g. volume/deliveryMonths
- rendered as "20 t per month for 6 months" on the listing and in the generated agreement.

**New: broadcast on publish.** When a TENDER listing is created, every APPROVED UTILIZER
company gets a notification `TENDER_PUBLISHED` with title
`"New tender: <volume> t of <concentration>% CO2 at ₹<base>/t"`, `referenceType="LISTING"`,
`referenceId=listingId`. Same for AUCTION with type `AUCTION_SCHEDULED`.

### 1.2 Utilizer applies
Unchanged: quantity ≤ listing volume, `offeredPricePerTonne` ≥ `basePricePerTonne`
(reject with 400 otherwise), required purity, duration, escrow, notes. The purification
estimate already exists via `POST /api/costs/estimate` and stays exactly as is.

### 1.3 Emitter reviews — **profit-optimal multi-award** (the core change)

The emitter may accept **one or more** proposals whose quantities together fit the released
volume. The system recommends the combination that earns the most money.

**Revenue of a proposal** = `quantityTonnes × offeredPricePerTonne`.

**Optimiser** (`com.carbonmarket.scoring.TenderOptimizer`): exact 0/1 knapsack.
- capacity = listing `volumeTonnes`, weights = proposal quantities, values = revenue
- quantities scaled to integer tenths of a tonne (`round(t * 10)`) so fractional volumes work
- dynamic programming over `capacity × proposals`; guard: if `scaledCapacity * n > 20_000_000`
  fall back to greedy by revenue-per-tonne descending and set `"exact": false` in the response
- **tie-break on equal total revenue**, applied in this order:
  1. higher summed tier rank (BRONZE 1, SILVER 2, GOLD 3, DIAMOND 4)
  2. higher summed hidden score
  3. lower total quantity (leaves more free stock)
  4. earlier submission timestamps

Worked examples from the brief, both must hold in tests:

| Case | Proposals | Capacity | Chosen | Leftover |
|---|---|---|---|---|
| A | U1 500 t, U2 500 t, U3 1000 t, with U1+U2 revenue > U3 revenue | 1000 t | U1 + U2 | 0 t |
| B | U1 800 t @ ₹1,00,000 total, U2 1000 t @ ₹50,000 total | 1000 t | U1 only | 200 t returns to free |

`GET /api/listings/{id}/award-suggestion` (EMITTER, owner only) →
```json
{ "listingId": "...", "capacityTonnes": 1000,
  "exact": true,
  "recommended": { "proposalIds": ["..."], "totalRevenue": 4300000, "totalTonnes": 1000,
                   "leftoverTonnes": 0, "utilizers": ["Gujarat Methanol Synthesis", "..."] },
  "alternatives": [ { "label": "Highest single bidder", "proposalIds": ["..."], "totalRevenue": 3900000, "totalTonnes": 1000, "leftoverTonnes": 0 },
                    { "label": "Best trust-weighted", "proposalIds": ["..."], "totalRevenue": 4100000, "totalTonnes": 900, "leftoverTonnes": 100 } ],
  "explanation": "Accepting Gujarat Methanol Synthesis (500 t) and Sabarmati Agro Greenhouses (500 t) earns ₹43,00,000, which is ₹4,00,000 more than the best single bidder. Both fit the 1000 t released.",
  "perProposal": [ { "proposalId": "...", "utilizerName": "...", "tier": "GOLD", "quantityTonnes": 500,
                     "offeredPricePerTonne": 4300, "revenue": 2150000, "inRecommendation": true,
                     "score": 70.8, "scoreBreakdown": { ... } } ] }
```
The existing weighted `score` and `scoreBreakdown` are **kept** and shown alongside, because
they explain *reliability*; the optimiser explains *money*. The emitter decides.

**Award endpoint becomes multi-select.** Replace the single-id body:
```
POST /api/listings/{id}/award   { "proposalIds": ["...", "..."] }
```
- 400 if empty, if any proposal is not SUBMITTED on this listing, or if `Σ quantity > volumeTonnes`
- creates **one agreement per accepted proposal** (each PENDING_VERIFICATION, each with its own
  SALE_APPROVAL verification request, priority 4)
- accepted proposals → AWARDED, all others → REJECTED with notification
- `leftover = volumeTonnes − Σ accepted quantity` is **released back to the passport's free stock**
- listing → AWARDED; audit event `TENDER_AWARDED` with the winning set and leftover
- the old single-id form is dropped; the frontend is updated in the same change

### 1.4 Emitter badge — volume sold (new)
Utilizer badges keep the existing completion/cancellation formula. Emitters get a badge from
**cumulative tonnes sold** (sum of `volumeTonnes` over their ACTIVE and COMPLETED agreements):

```
< 500 t BRONZE | 500–1,999 SILVER | 2,000–4,999 GOLD | >= 5,000 DIAMOND
```
`TrustDto` gains `tonnesSold` and `badgeBasis` ("volume sold" for emitters, "completed
agreements" for utilizers) so the UI can label it honestly. Recompute on agreement
create/complete/cancel.

---

## 2. Auction flow — scheduled live ascending auction (rebuild)

### 2.1 Emitter schedules
`POST /api/listings` with `mode=AUCTION` now takes:
- `volumeTonnes`, `basePricePerTonne` (opening price), passport
- `bidIncrement` double — fixed step added by each bid, e.g. ₹100/t (required, > 0)
- `scheduledStartAt` Instant — when bidding opens (must be future)
- `durationMinutes` int — how long it stays live (required, > 0); `closesAt = scheduledStartAt + durationMinutes`

Listing status for auctions: `SCHEDULED → LIVE → ENDED` (plus `CANCELLED`).
A scheduled job every 10 seconds flips SCHEDULED→LIVE at `scheduledStartAt` and LIVE→ENDED at
`closesAt`. Transitions also evaluated lazily on read so a demo never waits on the scheduler.

### 2.2 Bidding
New table `auction_bids`: id, listing_id, utilizer_id, amount_per_tonne, total_amount,
placed_at, binding_accepted bool.

`POST /api/listings/{id}/bids` (UTILIZER) `{ "acceptBindingTerms": true }`
- 409 unless listing is LIVE
- 400 unless `acceptBindingTerms` is true — this is the signed commitment: **winning is
  non-cancellable, and a deposit is non-refundable if abandoned**. The accepted text is stored
  on the bid and reproduced in the agreement document.
- amount is computed by the server, never sent by the client:
  `first bid = basePricePerTonne`, otherwise `currentPrice + bidIncrement`
- 409 if the caller already holds the leading bid (no bidding against yourself)
- utilizer must be APPROVED and must not be the emitter
- updates listing `currentPricePerTonne` and `currentLeaderId`; audit `AUCTION_BID`
- **anti-sniping**: a bid inside the final 60 seconds extends `closesAt` by 60 seconds
- notifies the previous leader `OUTBID`

`GET /api/listings/{id}/auction` (any approved company) → live state, safe to poll every 2 s:
```json
{ "listingId": "...", "status": "LIVE", "scheduledStartAt": "...", "closesAt": "...",
  "serverTime": "...", "secondsRemaining": 143,
  "basePricePerTonne": 5000, "bidIncrement": 100,
  "currentPricePerTonne": 5400, "nextBidPricePerTonne": 5500,
  "volumeTonnes": 50, "currentTotal": 270000,
  "leader": { "companyId": "...", "displayName": "Bidder #3", "tier": "GOLD", "isYou": false },
  "bidCount": 5, "youAreLeading": false, "canBid": true, "blockedReason": null,
  "bids": [ { "displayName": "Bidder #3", "tier": "GOLD", "amountPerTonne": 5400,
              "totalAmount": 270000, "placedAt": "...", "isYou": false } ] }
```
**Identity privacy during a live auction:** other bidders appear as stable pseudonyms
("Bidder #1", numbered by first bid) plus their tier. The emitter and admin/regulator see real
company names. After the auction ends, the winner's name is revealed to the emitter and the
winner. This keeps the existing privacy rule consistent.

### 2.3 Close and award
When an auction reaches ENDED:
- no bids → listing CLOSED, full volume released back to free stock, emitter notified
- otherwise the **last (highest) bid wins** automatically: agreement created
  (mode AUCTION, PENDING_VERIFICATION, volume = listing volume, price = final per-tonne),
  SALE_APPROVAL verification request raised, winner and emitter notified, audit `AUCTION_WON`
- because the bid was binding, the winner cannot cancel; `POST /agreements/{id}/cancel` returns
  409 for an AUCTION agreement cancelled by the utilizer, and the deposit is forfeit

### 2.4 Dashboards
- Utilizer `GET /api/auctions?filter=live|upcoming|ended` → auctions they can see, each with
  the summary block above
- Emitter `GET /api/auctions/mine` → their auctions with live bid counts and current price

---

## 3. Negotiation flow — unchanged
Utilizer requests direct contact, emitter accepts, they exchange versioned offers, acceptance
creates a CONTRACT agreement and locks volume. Already implemented; do not modify.

---

## 4. Frontend work

**Emitter**
- Listing create form: tender gains delivery-schedule fields; auction gains increment,
  scheduled start, duration, and drops the reserve-price field.
- Tender detail: recommendation panel showing the optimal combination, the money it earns,
  the difference against the best single bidder, leftover returning to stock, and checkboxes
  to accept multiple proposals with a live running total against capacity. Award button is
  disabled while the selection exceeds capacity.
- New "Live auctions" page: current price, bid count, countdown, bid history with real names.

**Utilizer**
- Notification-driven: `TENDER_PUBLISHED` and `AUCTION_SCHEDULED` deep-link to the listing.
- Auctions page with three tabs: Live, Upcoming, Ended.
- Live auction room: big current price, next bid price, countdown from `serverTime`, bid
  history with pseudonyms and tiers, one primary Bid button that states the exact committed
  amount, and a binding-terms checkbox that must be ticked before the first bid. Poll every 2 s.
- Tender apply form unchanged apart from showing the delivery schedule.

**Both:** badge tooltip explains its basis (volume sold vs completed agreements).

---

## 5. Tests that must exist
- `TenderOptimizerTest`: cases A and B above; a tie broken by tier; capacity exactly filled;
  a single proposal larger than capacity is excluded; empty input.
- Multi-award integration: two winners create two agreements, leftover returns to free stock,
  losers are REJECTED, over-capacity selection is rejected with 400.
- Auction: bid before LIVE is 409; bid without binding terms is 400; increment arithmetic;
  self-outbid blocked; anti-snipe extension; ENDED with no bids releases volume; ENDED with
  bids creates the agreement for the last bidder; utilizer cancel of an auction agreement is 409.
- Emitter badge tiers by tonnes sold.
