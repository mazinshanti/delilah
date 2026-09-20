# Saudi source connections — 20 September 2026

Candidate refinement of production 090b09d1536185582c2ad05d67b0bcf8b83872df. No redesign or replacement of search.

## What changed

Five scheduled individual-stock adapters: Mstaml, Motory, SAMACO Automotive, ArabWheels Saudi, and Kayishha. These add to seven existing connectors. The directory contains 41 research targets, including dealers on other marketplaces; it is not 41 independent working feeds.

Collection runs outside customer requests, with source policy checks, bounded concurrency, exact listing identities, real observed pagination and saved continuation queues. Source failures do not disable the other collectors or Haraj. Existing snapshot records and freshness timestamps are preserved.

New-vs-used protection remains: source condition evidence is required; conflicting new/high-mileage data is rejected. SAMACO explicitly used vehicles stay used even at 10 km. Kayishha requires an exact-ad explicit odometer over 100 km and sale evidence. Unknown condition is not admitted to the production snapshot.

Mstaml rent-to-own ads are rejected; bids and conflicting odometers stay null. Motory one-riyal placeholder prices stay null. ArabWheels recommendations are ignored because their JSON-LD can describe another car. Each primary ad is bound to its canonical URL and displayed ad ID.

Source gallery URLs are checked at ingestion. Only successfully decoded images at least 480×240 are retained (up to three observed images per vehicle); no generated or guessed image URLs, stretching, or upscaling. Failed/small images use the existing neutral fallback.

## Live sample

44 accepted vehicles; bounded sample, not whole-market coverage. Image checks cover the retained gallery images, not all images offered by each source. No market-coverage percentage can be established from this sample.

| Source | Discovered | Checked | Accepted | Usable image | ≥640px image | Price | Mileage |
|---|---:|---:|---:|---:|---:|---:|---:|
| Mstaml | 6 | 6 | 1 | 1 | 1 | 0 | 0 |
| Motory | 20 | 15 | 14 | 14 | 14 | 10 | 13 |
| SAMACO Automotive | 24 | 15 | 13 | 8 | 8 | 13 | 13 |
| ArabWheels Saudi | 25 | 15 | 9 | 8 | 8 | 5 | 9 |
| Kayishha | 158 | 8 | 7 | 7 | 7 | 0 | 7 |

All accepted sample records have canonical make/model, known condition, and successful source-detail responses. Counts are source records, not independently inspected cars. Cash asking-price omissions are intentional when evidence is insufficient.

## Every target and its disposition

| Target | Integration status | Evidence / remaining limitation |
|---|---|---|
| OTM Motors | not-connected | Dealer-owned site and sales route confirmed. Terms require permission to reuse content; authorized feed not obtained. robots.txt returned 404. |
| 4Cars Showroom | trial-discovery | Active showroom identified on Haraj and AUTO.AE. Independent inventory endpoint not confirmed; unrelated car-wash business excluded. |
| Nojoom Al Falah Cars | trial-discovery | Active multibrand seller and branches confirmed in public business profile; direct feed not obtained. |
| Ramz Al Asalah Showroom | trial-discovery | Active public seller page independently discovered; direct website/feed not confirmed. |
| V12 Showroom | not-connected | Business corroborated through ArabWheels dealer search; independent stock endpoint unconfirmed. |
| Al Raqi Cars Showroom Jeddah | not-connected | Independent Motory business directory confirms used-car showroom; feed absent. Not merged with similarly named Riyadh seller. |
| Zodha | not-connected | Auction source; advertised vehicle index requests failed in this audit. No bids treated as cash prices. |
| Al Jazirah Ford and Lincoln | catalog-only | Official dealer and pre-owned program confirmed; individual stock feed not connected. |
| Kia Aljabr | catalog-only | Official model catalog and test drives; no individual stock imported. |
| Almajdouie Motors | catalog-only | Dealer group brand portfolio confirmed; no authorized inventory feed obtained. |
| Hyundai Wallan | catalog-only | Official central-region distributor catalog; individual stock integration absent. |
| Haraj | connected-live | Live search plus bounded catalog-driven snapshot collection; exact-ad detail evidence is required for indexed records. Coverage is partial, not the full Haraj market. |
| OpenSooq | connected-live | Existing public Vehicle JSON-LD adapter. |
| Syarah | connected-index | Public server-rendered inventory with explicit vehicle fields and pagination. |
| CarSwitch Saudi | connected-index | Current ItemPage/mainEntity Car schema, public pagination; 1-second crawl delay. |
| Saudi Sale | connected-index | Public listing cards; only records with evidenced make/model/year/condition accepted. |
| Mercedes-Benz Saudi | connected-index | Official Saudi OfferCatalog; image and location may be absent from list schema. |
| Saleh Cars | connected-live | Live sitemap and individual product adapter for new cars. |
| YallaMotor | blocked | Direct inventory request returned HTTP 403; no access-control bypass. |
| BMW Naghi | not-connected | Public used-stock page has no vehicle records in initial HTML; API/ajax/search paths disallowed. |
| Audi Approved Samaco | evaluating | robots.txt returns a redirect to /en, not a usable policy; standalone connector not enabled. SAMACO stock is integrated separately. |
| Volkswagen Certified Samaco | evaluating | robots.txt returns a redirect to /en, not a usable policy; standalone connector not enabled. SAMACO stock is integrated separately. |
| Carly | evaluating | 1,595 vehicle URLs found in the public sitemap. Two detail URLs returned the same application shell, without vehicle evidence. No stock imported; a verified public production data route is still needed. |
| Dubizzle Saudi | authorization-required | Public inventory inspected. Saudi terms prohibit scraping and commercial reuse without a licence; no inventory imported. No official public inventory API confirmed. |
| Hatla2ee Saudi | not-connected | Public classifieds discovered; parser and access validation pending. |
| Syarati | not-connected | Observed generated-image service URLs in the public inventory. Actual seller stock has not been established; excluded. |
| Toyota Abdul Latif Jameel | catalog-only | Official model starting prices are not individual vehicles; excluded from inventory. |
| Abdullah Hashim Honda | catalog-only | Distributor website; no verified individual stock feed connected. |
| Petromin Nissan | catalog-only | Model catalog and showroom information; no verified stock feed connected. |
| Petromin Stellantis | catalog-only | Official distributor confirmed; individual inventory integration pending. |
| GMC Saudi Certified | catalog-only | Certified program information is not an individual inventory feed. |
| Abdul Latif Jameel Finance Used Cars | not-connected | Dealer stock page discovered on Motory; independent source ingestion pending. |
| Mstaml | connected-index | Individual stock adapter with exact-ad evidence gates; bounded scheduled collection. See inventoryCount and sync diagnostics for actual availability. |
| Motory | connected-index | Individual stock adapter with exact-ad evidence gates; bounded scheduled collection. See inventoryCount and sync diagnostics for actual availability. |
| ArabWheels Saudi | connected-index | Individual stock adapter with exact-ad evidence gates; bounded scheduled collection. See inventoryCount and sync diagnostics for actual availability. |
| Kayishha | connected-index | Individual stock adapter with exact-ad evidence gates; bounded scheduled collection. See inventoryCount and sync diagnostics for actual availability. |
| SAMACO Automotive | connected-index | Individual stock adapter with exact-ad evidence gates; bounded scheduled collection. See inventoryCount and sync diagnostics for actual availability. |
| Expatriates Saudi Vehicles | discovery-only | Saudi car category inspected 2026-09-20; includes wanted/scrap/service ads and malformed prices; no automatic inventory admission |
| Khaled Cars | discovery-only | Reviewed dealer starting-price offers, not verified individual stock. Existing review parser is retained; no fabricated vehicle inventory. |
| ظل الجزيرة للسيارات | discovery-only | Homepage readable, but repeat robots/detail requests returned 406 or failed. Not enabled. |
| GCC Car Deals Saudi | discovery-only | Comparison source; original seller and individual stock must be verified before ingestion. |

The three named Haraj showrooms remain discovery targets under Haraj, not three extra independent marketplace connectors. Dubizzle and OTM require the documented authorized access/feed; neither has been silently enabled. Manufacturer catalogs and starting prices are not individual stock.

## Validation

482 automated tests passed locally, including source binding, false-new rejection, rental and price guards, related-card exclusion, image failure/size handling, and continuation queues. Full index/search, CI, Arabic/English desktop/mobile and deployment verification remain release gates. See sample-qa.json and readiness.json for measured source limitations.
