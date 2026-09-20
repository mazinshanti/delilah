# Source integration readiness — 2026-09-20

## Scope and release decision

41 configured research targets were audited. A readable page is not verified inventory, an agreement, an active connector, or evidence of market-wide coverage. No inventory was admitted by this audit. No production release was performed.

## Implemented in this change

- Haraj showroom discovery accepts encoded public seller paths while retaining the existing strict individual-ad parser and quarantine checks.
- The existing OpenSooq source now exposes supported English individual-ad and category routes to the isolated AI discovery trial. Unknown condition still fails a used-only request.
- Added a reproducible, bounded public readiness audit with robots checks, per-origin sequencing, four concurrent origins, source-specific selection, response hashes, and explicit failure outcomes.
- URL serialization fixes raw spaces in Arabic dealer URLs before requesting them.

## Verification

445 automated tests passed; zero failures. `npm run check` and syntax checks for both new audit scripts passed. This is code regression evidence, not successful live validation of every connector. Live image downloads/dimensions, mobile and desktop end-to-end QA, and production latency remain unverified for these additions.

## Live evidence

| Source | Reachability outcome | HTTP | Registry status |
|---|---|---|---|
| 4Cars Showroom | fetch-failed | — | not-connected |
| Abdul Latif Jameel Finance Used Cars | page-readable | 200 | not-connected |
| Abdullah Hashim Honda | page-readable | 200 | catalog-only |
| Al Jazirah Ford and Lincoln | page-readable | 200 | catalog-only |
| Al Raqi Cars Showroom Jeddah | page-readable | 200 | not-connected |
| Almajdouie Motors | HTTP 403 | 403 | catalog-only |
| ArabWheels Saudi | page-readable | 200 | evaluating |
| Audi Approved Samaco | robots-unavailable | — | evaluating |
| BMW Naghi | robots-unavailable | — | not-connected |
| CarSwitch Saudi | fetch-failed | — | connected-index |
| Carly | page-readable | 200 | evaluating |
| Dubizzle Saudi | authorization-pending | — | authorization-required |
| Expatriates Saudi Vehicles | robots-unavailable | — | discovery-only |
| GCC Car Deals Saudi | page-readable | 200 | discovery-only |
| GMC Saudi Certified | robots-unavailable | — | catalog-only |
| Haraj | page-readable | 200 | connected-live |
| Hatla2ee Saudi | robots-unavailable | — | not-connected |
| Hyundai Wallan | redirect-review | 308 | catalog-only |
| Kayishha | robots-unavailable | — | not-connected |
| Khaled Cars | page-readable | 200 | discovery-only |
| Kia Aljabr | page-readable | 200 | catalog-only |
| Mercedes-Benz Saudi | robots-unavailable | — | connected-index |
| Motory | redirect-review | 301 | legacy-discovery |
| Nojoom Al Falah Cars | fetch-failed | — | not-connected |
| OTM Motors | authorization-pending | — | not-connected |
| OpenSooq | redirect-review | 301 | connected-live |
| Petromin Nissan | fetch-failed | — | catalog-only |
| Petromin Stellantis | page-readable | 200 | catalog-only |
| Ramz Al Asalah Showroom | fetch-failed | — | not-connected |
| SAMACO Automotive | page-readable | 200 | not-connected |
| Saleh Cars | robots-unavailable | — | connected-live |
| Saudi Sale | fetch-failed | — | connected-index |
| Syarah | page-readable | 200 | connected-index |
| Syarati | page-readable | 200 | not-connected |
| Toyota Abdul Latif Jameel | page-readable | 200 | catalog-only |
| V12 Showroom | page-readable | 200 | not-connected |
| Volkswagen Certified Samaco | robots-unavailable | — | evaluating |
| YallaMotor | robots-unavailable | — | blocked |
| Zodha | page-readable | 200 | not-connected |
| ظل الجزيرة للسيارات | page-readable | 200 | discovery-only |
| مستعمل | page-readable | 200 | discovery-only |

Initial audit counts: 19 readable, 10 robots unavailable, 6 fetch failures, 3 redirects requiring review, 2 authorization pending, 1 HTTP 403. Transient failures do not prove permanent source blocking. The three Arabic Haraj seller URLs were rechecked after URL serialization: all returned HTTP 200. Thus the latest reachability observation is 22 readable targets out of 41; this is not 22 validated connectors. Original and recheck reports are preserved separately.

## Dealer detail validation

The three repaired seller pages yielded 61 observed ad links (20, 20, 21). Six detail URLs were checked. One passed the existing Haraj evidence gates: Nissan Patrol Platinum 2022, SAR 180,000, used, mileage unknown. The five other outcomes were one timeout, one vehicle-boundary rejection, two missing-year rejections, and one unresolved identity. The accepted image downloaded and decoded at 900×675 pixels, despite 1800x1350 appearing in the URL. URL dimensions are not verified image resolution. This small sample is not a source-wide acceptance estimate. Raw outcome evidence is in `docs/qa-20260920/dealer-detail-recheck.json`.

## Concrete unresolved work

- Mstaml: a real Saudi vehicle detail page was read. Its labelled mileage (582 km) conflicts with its description (582 thousand km). The structured price (SAR 20,000) also accompanies bidding language. A source-specific evidence reader is required before admission. Generic Product JSON-LD is insufficient for this mixed-category marketplace.
- Mstaml IDs are query parameters; the current trial strips queries. It must preserve validated source identity before this source can be safely activated.
- SAMACO and Al Jazirah: stock routes were observed, but follow-up robots fetches timed out. No verified individual stock reader was activated.
- ArabWheels/GCC Car Deals: reachable category/comparison pages do not establish original seller stock; trace the original listing before ingestion.
- Syarati: template-like assets/contact placeholders were observed; no independently validated individual stock evidence was established.
- Catalog-only OEM pages cannot be counted as listings.
- Explicit access restrictions remain restrictions; this change does not bypass them.
- Source discovery and repeated lookup performance must be measured on Render. Earlier candidate timings were about 25 seconds cold to first accepted result; cache timing alone is not a user-perceived speed claim.

## Resume

Run all targets: `node scripts/audit-source-readiness.mjs /tmp/source-audit`
Run selected targets: `node scripts/audit-source-readiness.mjs /tmp/source-recheck fourcars nojoom-alfalah ramz-alasalah`

The audit uses no OpenAI credentials and changes no inventory. Full research evidence is in `docs/qa-20260920/source-readiness.json`. Do not merge to main or deploy this candidate as an all-source production release.
