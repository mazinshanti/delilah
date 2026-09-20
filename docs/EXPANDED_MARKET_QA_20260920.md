# Expanded source QA — 2026-09-20

Candidate branch only. No production inventory write, main merge or deployment.

## Measured sample

425 unique candidate URLs; 174 unique detail URLs checked; 95 distinct listings accepted across the combined samples. Nine direct-query cases plus separate dealer samples. Zero AI-provider calls in these live samples. These are bounded observations, not full market totals.

| Source | Unique checked | Accepted for queries | Image URL | Price | Mileage | Known condition |
|---|---:|---:|---:|---:|---:|---:|
| Haraj | 81 | 41 | 41 | 16 | 20 | 41 |
| Syarah | 30 | 24 | 24 | 24 | 22 | 24 |
| CarSwitch Saudi | 39 | 19 | 19 | 19 | 19 | 19 |
| Saudi Sale | 12 | 0 | 0 | 0 | 0 | 0 |
| Mercedes-Benz Saudi | 12 | 11 | 11 | 11 | 11 | 11 |

## Timing — local source benchmark, not Render/UI

| Query | Accepted | First result seconds | Total seconds |
|---|---:|---:|---:|
| Toyota Corolla | 15 | 38.2 | 107.0 |
| كورولا | 15 | 37.8 | 92.7 |
| Hyundai Elantra | 17 | 20.7 | 76.9 |
| Nissan Patrol | 10 | 18.5 | 79.4 |
| BMW X5 | 13 | 20.1 | 234.7 |
| Mercedes C-Class | 1 | 113.7 | 117.7 |
| Ford F-150 | 7 | 22.3 | 221.4 |
| Porsche 911 | 2 | 20.4 | 93.8 |
| MG ZS | 14 | 22.4 | 89.9 |

First results took 18.5–113.7 seconds in this environment. This is not an acceptable production latency result. It cannot be compared directly with previous Render AI trials: environment, query set and discovery method differ. Cached in-process filtering took 6.5–23.5 ms; this excludes network, intent parsing and rendering and is NOT a user-visible response-time claim.

## Root causes and implemented refinements

- The trial waited for AI discovery before reading any source page. Added a bounded catalog-seed batch and provider prefetch in parallel. An asynchronous regression test verifies that a fully validated source result emits while provider discovery remains pending. A real provider-backed cold/warm comparison is still required.
- Official Mercedes inventory links exist in JSON-LD OfferCatalog, not ordinary anchors. Generic bounded JSON-LD URL discovery recovered 24 observed links; a live recheck accepted 11 of 12 details. All 11 had a price, mileage, condition and image URL. One request failed; 12 more links remained pending.
- Syarah model categories can use a different taxonomy from Dalelah; model routes for BMW X5, Mercedes C-Class and Ford F-150 returned 410 in this sample. Added a same-make category fallback for 404/410 only; filters remain unchanged. The fallback implementation is regression-tested, but its incremental live yield has not been measured.
- Initial page batches could consume every detail slot before a fallback or next page was visited. Reserve slots for pending discovery pages within the existing page/detail budgets.
- Clear different-make URLs could consume checks ahead of unknown/matching candidates. Scheduling now lowers their priority without accepting or permanently discarding them. Model-family differences are deliberately not used as an early rejection rule.
- Empty source responses were reported as missing vehicle evidence. They now receive a distinct empty-source-response diagnostic. One Saudi Sale detail was independently fetched with an empty body. Do not assume every Saudi Sale failure has the same cause.

## Remaining source and catalog limitations

- Saudi Sale: 12 checked, zero accepted in this sample. Keep failures visible; these do not prove its real inventory is empty.
- Saleh Cars: sitemap yielded 394 distinct product URLs. One Corolla product page was inspected after an initial timeout; it is available upon request. These were not added to accepted-stock totals or enabled as a new trial adapter.
- OpenSooq: robots request returned HTTP 403 here; no protected routes were bypassed.
- Audi Approved and Volkswagen Certified Saudi public pages show a loading-cars placeholder in the public page extraction. Their inventory adapters remain unevaluated; no stock counts claimed.
- Existing canonical model distinctions exclude some C200/C versus C-Class and 911 Carrera versus 911 results. This was observed in the exact query rejection logs. No broad substring/family matching was enabled. A catalog relationship change requires its own positive and negative regression fixtures.

## Image QA

Eight images (first two available per source, not a random sample) were downloaded and decoded successfully: CarSwitch 1215x546 and 1215x911; Syarah 911x683 twice; Haraj 768x1024 and 594x1024; Mercedes 1536x1024 and 1401x934. This is an 8/8 sample, not a whole-source success rate.

## Validation and release status

413 automated tests passed; syntax checks passed. No classifier, quarantine, source ranking, UI, seller or valuation code changed in this pass. The main nine-query run began before the later OfferCatalog/fallback/scheduling refinements; do not attribute its counts to those later changes. Mercedes has its own post-fix live recheck.

Production integration, real AI-provider benchmark, Arabic/English UI and mobile/desktop gates remain outstanding. No live deployment SHA is claimed. Raw sampled listings, check outcomes, summary and image checks are retained alongside this document.
