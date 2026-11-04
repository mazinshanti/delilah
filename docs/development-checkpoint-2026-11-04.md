# Dalelah development checkpoint — 2026-11-04

> Durable engineering checkpoint for continuing development in `mazinshanti/delilah`. Confirm current runtime and data before making new claims. This is a repository record, not a promise that any future scheduled work is running.

## Product goal and boundaries

Dalelah (`www.dalelah.co`) is an Arabic-first, Saudi-market car **search aggregator**. Users can search by make, model, year, price, mileage, city and natural language; get source-attributed vehicle summaries with original listing links; and discover more on source sites. The long-term goal is broad nationwide coverage, fast progressive results and lightweight short-lived cached search metadata. Public search-result indexing and outbound links differ from copying full listings/photographs; follow source-specific terms, robots/access controls and applicable requirements. No authorization has been inferred from source attribution alone.

## Last verified production state

- GitHub main release: `aac6b477d2de08ef59121df6efb6f45c94002526` (2026-11-04).
- Render production frontend `srv-daffiulbedkc73920310` and deep search backend `srv-daff93ou01pc73a7nqe0`: both reported **live** on that commit.
- Live public smoke from GitHub Actions on 2026-11-04: `freshOnly:true` Toyota Camry returned 21–22 early source-observed listings, zero records failing explicit recent source timestamp checks; ordinary Toyota Camry search returned 190 listings, first response 731 ms. Both checks passed. These are examples, **not** total Saudi inventory counts; the fresh-only scan was still in progress.
- Last completed indexed snapshot audit (2026-11-02): **12,438 retained source listing URLs** from 10 observed sources; snapshot generation `2026-09-23T17:07:49.763Z`; **zero** rows inside the 36-hour recency window as of audit. This is a historical baseline and may differ from current values. Do not equate an expired freshness window with a sold vehicle, or imply a verified national market coverage percentage.

## Implemented and tested

1. Fast indexed search, live-first source queries for Haraj/OpenSooq, and deeper legacy source fanout; original source attribution and links. Known limits: not exhaustive, not every source is refreshed in real time.
2. Arabic natural-language family SUV search with deterministic verified-constraint fallback; strict year, model, body type and verified price ceiling checks.
3. Bounded-memory compressed snapshot indexing; previous Render frontend out-of-memory failure fixed.
4. Public `/api/inventory/coverage` endpoint reports source-specific URL counts, observation freshness and field evidence, and refuses to claim market-wide completeness.
5. Honest listing-age labels in Arabic/English, and outbound exact-model search links to supported original market sites.
6. Process-local `LiveVehicleBuffer` (10-minute TTL, up to 2,500 rows; no downloaded image files), recent observation stamping on directly fetched source pages, progress polling / results memoization.
7. Optional `freshOnly` search mode filters returned vehicles to explicit Haraj/OpenSooq source-search sightings from the last ten minutes; the normal historical search remains available.
8. Authorized dealer-feed candidate ingestion path and source provenance validation. No external marketplace permission or additional dealer data is assumed.

## Remaining gaps, in priority order

- **Coverage and recency:** 12,438 historical URLs do not constitute every Saudi car; obtain reliable new source coverage/approved feeds and recheck each listing rather than silently refreshing old timestamps.
- **Live-mode integrity:** Restrict a claimed source observation to the real source hostname and explicit `source-search-result-page` evidence. Reject spoofed or stale timestamps before the temporary buffer accepts a record.
- **Progressive UX:** Ensure fresh-only and normal searches preserve results across polling, display source errors, and never imply a 100% search of the Saudi market.
- **Resource efficiency:** Bound result cache memory and TTL; do not store user queries or full replicated image galleries longer than needed. No new request traffic to sources without source-specific access review.
- **Repeatable evidence:** Benchmark first-result time and unique URLs with diverse makes/models and filters. Measure *incremental* verified listings, not only raw index size.

## Key references

- `https://github.com/mazinshanti/delilah/pull/40`: fresh-only search, merged.
- `https://github.com/mazinshanti/delilah/pull/41`: independent live smoke (QA).
- `https://github.com/mazinshanti/delilah/issues/27`: urgent stale-inventory refresh.
- `https://www.dalelah.co/api/inventory/coverage`: live source evidence dashboard API.
- Main components: `server-core-candidate.js`, `lib/live-vehicle-buffer.js`, `lib/live-source-observation.js`, `lib/recent-source-results.js`, `public/market-ui.js`.

## Next engineering checkpoint

Harden **temporary source evidence** while retaining speed: validated hostnames and source observation kinds, clock-safe TTL expiry, memory bounded by fixed size, regression tests and a post-deployment live smoke. Do not misrepresent this as growing indexed inventory.
