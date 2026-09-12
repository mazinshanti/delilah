# Dalelah Production Checkpoint — 12 Sep 2026

## Frozen production state
- Production main commit: `9ab59627cf9cdeef5c74b7a1b0af8a9b42761257`
- Product version: Dalelah 1.5
- Public production: `https://www.dalelah.co`
- Front runtime: `https://delilah-pm5f.onrender.com`
- Deep-search runtime: `https://delilah-live-search.onrender.com`
- Runtime split preserved: front = direct-first; deep service = legacy-deep.

## Search architecture
Dalelah uses a direct-first search layer for fast results and continues with the deeper market scan progressively. Main source chain remains intact. Haraj, OpenSooq, Syarah, Saleh Cars and other existing adapters are not collapsed into one scraper.

## Haraj price import — live
The Haraj fast lane no longer defaults every result to `price:null`. The new evidence-first price matrix recognizes:
- `السعر 26000`
- `السعر: 21.000`
- `السعر : 29,000 ريال`
- `السعر 37 ألف`
- asking phrases such as `ابغى ... 19 الف`
- currency-labelled values
- formatted Haraj search-card prices such as `24,998`
- Arabic / Persian digits and common Saudi formatting.

Every imported Haraj price can carry:
- `price`
- `priceVerified`
- `priceSource`
- `priceEvidence`

Safety rules reject mileage, phone numbers, model years, open-ended `على السوم` pricing and implausible amounts. A Haraj junk-listing regression was added after a Patrol odometer/parts ad surfaced during QA.

## Haraj price QA result
Before release, tested production returned effectively 0 verified Haraj prices. Candidate testing produced roughly 36–37% verified price coverage across sampled Haraj searches, with higher fill on some models (e.g. Camry, Wrangler, Tahoe). No suspicious verified prices or candidate junk listings survived the final test matrix.

A background Haraj detail-page enrichment exists as a best-effort bonus. Search does not wait on it. It may recover additional seller-written `السعر ...` values when Haraj exposes enough detail server-side.

## QA / deployment guards
- Haraj price parser tests added.
- Haraj fast-source price tests added.
- Exact-year and junk-listing regressions added.
- Production QA now requires Haraj price feature flags in the deployed runtime.
- Regression suite, direct-core tests, price matrix tests, exact-year tests, brand relevance tests, marketplace tests and mobile exports passed before promotion.

## Marketplace foundation
Marketplace work remains separate from seller PII persistence. Seller storage fails closed until a Saudi-hosted production database/API is connected. Frankfurt Render Postgres is not to be used for seller/customer PII.

Target Saudi architecture remains Google Cloud Dammam (`me-central2`) for seller API, Cloud SQL PostgreSQL and Cloud Storage. This migration is intentionally deferred while product/UX/search intelligence continue.

## Mobile
Canonical mobile development branch before this checkpoint: `dalelah-mobile-app-mainline`.
Native Expo/React Native app is connected directly to Dalelah APIs:
- search -> production search API
- progressive search -> production progress endpoint
- sell valuation -> marketplace preview
- saved cars -> local device storage
No seller PII persistence, Mojaz, Keyloop/dealer feed or account sync is live yet.

## Product direction
Dalelah is evolving from a Saudi car-search aggregator into the Saudi used-car trust, intelligence and transaction layer:
1. Dalelah Search
2. Dalelah Price
3. Dalelah Verify
4. Dalelah Sell
5. Dalelah Checkout
6. Dalelah Pro / Data

Positioning: Find any car. Know what it is worth. Know what happened to it. Buy it safely.

## Next phase
Start from production main, not from experimental branches.
Recommended next phase: **Vehicle Data Intelligence**.
Priority sequence:
1. Evidence-first Haraj mileage import.
2. Normalize mileage across all sources.
3. Structured trim / engine / transmission / seller-type extraction where evidence exists.
4. Use year + mileage + verified price to strengthen Dalelah Price / deal score.
5. Add comparison confidence and comparable-count visibility.
6. Later connect Mojaz history and dealer feeds via official partnerships/APIs.

## Do not regress
- Exact requested year must remain exact.
- Do not infer price/mileage from arbitrary numbers.
- 403/429/timeouts are source availability failures, not proof of zero Saudi inventory.
- Do not bypass anti-bot protections.
- Do not persist seller PII outside Saudi infrastructure.
- Do not expose old internal server-version naming as the product version.
