# Dalelah — Saudi-wide automotive search

## Promise
Dalelah indexes real vehicle offers across Saudi Arabia. Never generate imaginary listings or claim all Saudi inventory is covered without independently measured coverage.

## Architecture
1. Maintain a registry for each marketplace and dealer feed: API or public access, allowed fetching policy, pagination, errors, scan timestamps, and rate limits. Respect site terms and robots/access controls.
2. Discover listings continuously in background jobs. Save pagination cursors and retry failures with backoff; do not scrape entire market on every request.
3. Extract make, model, trim, year, condition, price, mileage, city, seller, source link, images, evidence and last-verified timestamp.
4. Normalize bilingual aliases and numeric formats, remove non-vehicle ads, and deduplicate conservatively using source IDs and VIN where trustworthy. Preserve links to all original offers.
5. Persist structured fields plus Arabic/English full-text search indexes. Refresh active listings, and expire stale or withdrawn ads.
6. Interpret query as schema-validated AI intent with hard filters (make, model, year, price, body type, mileage, condition, city) and softer preferences. Never allow AI ranking to override hard filters.
7. Search the local index first; optionally use bounded on-demand marketplace calls when sources allow it. Label partial coverage or source failures.
8. Rank verified real listings using relevance, freshness, source confidence and user preferences. Display source, original URL, and last checked date.

## Measurement
Track per-source URLs discovered, valid cars, unique cars, active cars, staleness, errors, pagination depth and elapsed scan time. Track market coverage by city, make, model and year. Benchmark search recall, strict filter precision, response time and API cost.

## Regression searches
- تويوتا كورولا ٢٠١٣ → exact model year 2013.
- أبي جيب عائلي ياباني تحت ١٥٠ ألف → only qualifying vehicles within confirmed budget; no sedans.
- لكزس RX 2022 ممشى أقل من ٧٠ ألف → enforce model, year, and mileage.
- Peugeot 2008 → model name, not year filter.
- كامري من ٢٠٢٠ إلى ٢٠٢٣ → inclusive year range.

## Delivery plan
Phase A: audit actually integrated sources and measure current indexed inventory.
Phase B: add compliant, checkpointed crawlers, deduplication, stale removal, index and health metrics.
Phase C: structured intent, hard filters, bilingual/semantic search, grounded ranking.
Phase D: targeted near-real-time source updates and transparent partial coverage.
Phase E: automated relevance tests and source/cost monitoring.

## Current gap
On 2026-11-02, the direct fast lane uses Haraj/OpenSooq for used inventory and Saleh Cars for new inventory. Other source paths may exist elsewhere. Draft PR #17 fixes all-condition retrieval, but does not itself expand the Saudi-wide index or prove new unique inventory.
## Incremental snapshot collection (development only)
The front runtime already loads `data/market-inventory.json.gz`. A replacement index is **not** required for the first expansion phase.

An operator can collect one named-model sample through an existing supported source adapter, after verifying its access terms:
```sh
node scripts/collect-source-model.mjs --source "Haraj" --query "Toyota Corolla" --output haraj-corolla-batch.json
node scripts/merge-inventory-snapshot.mjs --snapshot data/market-inventory.json.gz --input haraj-corolla-batch.json --output next-market-inventory.json.gz
```

The collector is intentionally limited: a Haraj sample uses at most two sequential Arabic search variants; OpenSooq scans at most three pages; Saleh Cars uses the existing adapter. It stops Haraj variants upon HTTP 403/429 and does not bypass authentication or access controls. **These scripts do not authorize fetching or commercial reuse of third-party content.** Confirm source access/terms before execution.

The merge is conservative: it verifies sale listings, preserves unvisited source records, deduplicates URLs, removes unverified stale prices, and writes a new compressed file rather than overwriting the original snapshot. Keep the original for rollback. Verify the generated snapshot and its source metrics before deploying. Snapshot counts represent listing URLs, not necessarily unique physical vehicles. Deletion and source-level completeness require separate verified removal checks.
