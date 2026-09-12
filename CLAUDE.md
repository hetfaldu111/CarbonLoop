# Carbon Marketplace — notes for coding assistants

- Hard constraint: NO AI, NO ML, NO blockchain. Matching/scoring/pricing are deterministic weighted formulas (see docs/DESIGN.md). Never suggest ML-based matching or a ledger.
- docs/DESIGN.md is the contract between backend and frontend: entity fields, formulas, weights, REST routes, DTO shapes, seed data. Update it first when changing any of those.
- Backend: Spring Boot 3.5, Java 21 (JDK 25 installed), no Lombok. Run: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=h2` (no Docker) or default profile for PostgreSQL via `docker compose up -d`.
- Frontend: Angular 21 standalone + signals. Run: `cd frontend && npm start` (proxy /api → :8080).
- Volume allocation on a passport must always go through a PESSIMISTIC_WRITE lock (findByIdForUpdate) inside a transaction.
- Every state change records an audit event (hash-chained) and, where a party is affected, a notification.
- Demo accounts: see README.md (password `Password123!`).
