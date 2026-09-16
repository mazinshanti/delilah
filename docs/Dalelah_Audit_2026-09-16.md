Dalelah implementation and Saudi inventory audit — 16 September 2026

Snapshot: 2026-09-16T19:28:14.425Z. This is measured coverage, not a claim to contain the entire Saudi market.

Indexed inventory: **2,120 deduplicated listing records**, covering **64 source-reported makes**, **11 known cities**, **1,864 used** and **256 new** vehicles. **1,818 records have every requested field**; 302 have at least one missing field. Unknown values remain null. A source-published listing is not a Dalelah inspection or a guarantee the car remains unsold.

Implemented changes: source registry and four public-inventory parsers; compressed versioned inventory snapshot; 36-hour expiry; scheduled refresh at 02:17 and 14:17 UTC; immediate indexed results with background live searches; bounded Haraj/OpenSooq browsing; five-minute search reuse; API pagination and sorting; exact brand/model/year enforcement; New/Used separation; price/year/mileage/city/source/trim/fuel filters; VIN or conservative image-and-specification deduplication; API limits and security headers; PostgreSQL certificate verification; white/black minimal interface, accessible filter labels, source selection, 24-card rendering, and incremental pagination.

Search fixes include Bentley misspellings, conflicting source years/makes, Plus in model names, Peugeot 2008 versus model year, Arabic mileage multipliers, and parts/accessory rejection. The search shell and collected matches remain available when the deeper service fails.

Source registry

Counts below are collected snapshot records, not a source’s advertised total. A zero for a live adapter means it is not in the static snapshot; live probe counts are reported separately. Catalog starting prices are never imported as individual cars. No authenticated commercial feed was obtained during this task.

| Source | Connection | Indexed | All fields | Evidence / limitation |
|---|---|---:|---:|---|
| [OTM Motors](https://www.otm.com.sa/en) | not-connected | 0 | 0 | Dealer-owned site and sales route confirmed. Terms require permission to reuse content; authorized feed not obtained. robots.txt returned 404. |
| [4Cars Showroom](https://haraj.com.sa/users/فوركارز للسيارات/) | not-connected | 0 | 0 | Active showroom identified on Haraj and AUTO.AE. Independent inventory endpoint not confirmed; unrelated car-wash business excluded. |
| [Nojoom Al Falah Cars](https://haraj.com.sa/users/شركة نجوم الفلاح للسيارات/) | not-connected | 0 | 0 | Active multibrand seller and branches confirmed in public business profile; direct feed not obtained. |
| [Ramz Al Asalah Showroom](https://haraj.com.sa/users/معرض رمز الاصالة/) | not-connected | 0 | 0 | Active public seller page independently discovered; direct website/feed not confirmed. |
| [V12 Showroom](https://www.arabwheels.sa/) | not-connected | 0 | 0 | Business corroborated through ArabWheels dealer search; independent stock endpoint unconfirmed. |
| [Al Raqi Cars Showroom Jeddah](https://ksa.motory.com/en/guide/company/al-raqi-cars-showroom/) | not-connected | 0 | 0 | Independent Motory business directory confirms used-car showroom; feed absent. Not merged with similarly named Riyadh seller. |
| [Zodha](https://zodha.com.sa/) | not-connected | 0 | 0 | Public dealer auction directory found; bids are not sale prices. No inventory imported. |
| [SAMACO Automotive](https://www.samaco.com.sa/) | not-connected | 0 | 0 | Official dealer group and stock navigation confirmed; stock adapter not validated. Accessories excluded. |
| [Al Jazirah Ford and Lincoln](https://en.aljazirahford.com/) | catalog-only | 0 | 0 | Official dealer and pre-owned program confirmed; individual stock feed not connected. |
| [Kia Aljabr](https://www.kia.com/aljabr/en/main.html) | catalog-only | 0 | 0 | Official model catalog and test drives; no individual stock imported. |
| [Almajdouie Motors](https://www.almajdouie.com/) | catalog-only | 0 | 0 | Dealer group brand portfolio confirmed; no authorized inventory feed obtained. |
| [Hyundai Wallan](https://hyundaiksa.com/) | catalog-only | 0 | 0 | Official central-region distributor catalog; individual stock integration absent. |
| [Haraj](https://haraj.com.sa) | connected-live | 0 | 0 | Existing public search adapter; sparse fields require detail enrichment. |
| [OpenSooq](https://sa.opensooq.com) | connected-live | 0 | 0 | Existing public Vehicle JSON-LD adapter. |
| [Syarah](https://syarah.com) | connected-index | 1512 | 1242 | Public server-rendered inventory with explicit vehicle fields and pagination. |
| [CarSwitch Saudi](https://ksa.carswitch.com) | connected-index | 576 | 576 | Current ItemPage/mainEntity Car schema, public pagination; 1-second crawl delay. |
| [Saudi Sale](https://cars.saudisale.com) | connected-index | 8 | 0 | Public listing cards; only records with evidenced make/model/year/condition accepted. |
| [Mercedes-Benz Saudi](https://www.mercedes-benz-mena.com) | connected-index | 24 | 0 | Official Saudi OfferCatalog; image and location may be absent from list schema. |
| [Saleh Cars](https://www.salehcars.com) | connected-live | 0 | 0 | Live sitemap and individual product adapter for new cars. |
| [Kayishha](https://buy.kayishha.com) | not-connected | 0 | 0 | Public detail schema inspected: title/image/year but no price, city, trim or explicit condition. /api/ disallowed; incomplete records excluded. |
| [YallaMotor](https://ksa.yallamotor.com) | blocked | 0 | 0 | Direct inventory request returned HTTP 403; no access-control bypass. |
| [BMW Naghi](https://www.bmw-saudiarabia.com) | not-connected | 0 | 0 | Public used-stock page has no vehicle records in initial HTML; API/ajax/search paths disallowed. |
| [Audi Approved Samaco](https://audiapproved.com/en/saudiarabia) | evaluating | 0 | 0 | Saudi used-stock page discovered; adapter and record verification pending. |
| [Volkswagen Certified Samaco](https://vwcertified.me/en/saudiarabia) | evaluating | 0 | 0 | Saudi certified inventory discovered; adapter and record verification pending. |
| [Carly](https://www.halacarly.com) | evaluating | 0 | 0 | Public inventory and sitemap discovered; parser verification pending. |
| [Motory](https://ksa.motory.com) | legacy-discovery | 0 | 0 | Legacy discovery exists; source-specific measured inventory not yet certified. |
| [ArabWheels Saudi](https://www.arabwheels.sa) | evaluating | 0 | 0 | Public listing routes discovered; JSON endpoints disallowed by robots. |
| [Dubizzle Saudi](https://www.dubizzle.sa) | authorization-required | 0 | 0 | Public inventory inspected. Saudi terms prohibit scraping and commercial reuse without a licence; no inventory imported. No official public inventory API confirmed. |
| [Hatla2ee Saudi](https://ksa.hatla2ee.com/en/car) | not-connected | 0 | 0 | Public classifieds discovered; parser and access validation pending. |
| [Syarati](https://syarati.com/used-cars) | not-connected | 0 | 0 | Public used inventory page discovered; individual listing verification pending. |
| [Toyota Abdul Latif Jameel](https://www.toyota.com.sa/en) | catalog-only | 0 | 0 | Official model starting prices are not individual vehicles; excluded from inventory. |
| [Abdullah Hashim Honda](https://www.ahcl.com.sa) | catalog-only | 0 | 0 | Distributor website; no verified individual stock feed connected. |
| [Petromin Nissan](https://en.petromin-nissan.com) | catalog-only | 0 | 0 | Model catalog and showroom information; no verified stock feed connected. |
| [Petromin Stellantis](https://www.petromin-stellantis.com) | catalog-only | 0 | 0 | Official distributor confirmed; individual inventory integration pending. |
| [GMC Saudi Certified](https://www.gmcarabia.com/sa-en/certified-pre-owned) | catalog-only | 0 | 0 | Certified program information is not an individual inventory feed. |
| [Abdul Latif Jameel Finance Used Cars](https://ksa.motory.com/en/cars-dealers/dealer-abdul-latif-jameel-united-finance-used-cars-283165/) | not-connected | 0 | 0 | Dealer stock page discovered on Motory; independent source ingestion pending. |

Collection boundaries: CarSwitch produced 576 records over 24 pages, then page 25 returned HTTP 202/no inventory. Syarah produced 1,512 records over 126 pages, then page 127 timed out. Saudi Sale yielded eight eligible cards; pagination repeated the homepage. Mercedes supplied 24 structured offers. Access restrictions were not bypassed.

Additional discovery leads — no inventory connected

| Lead | Status | Imported | Reason |
|---|---|---:|---|
| [SaudiCarOffers](https://saudicaroffers.com/) | Catalog only | 0 | Financing and promotional offers; no verified individual stock feed. |
| [SayaraBay](https://www.sayarabay.com/) | Catalog only | 0 | Model prices and reviews; no individual stock integrated. |
| [Bentley Motors dealer locator](https://www.bentleymotors.com/) | Not connected | 0 | Official Saudi retailer discovery; SAMACO is separately registered above. No dealer stock feed obtained. |
| [Kia NMC distributor reference](https://www.kia.com/) | Not connected | 0 | Distributor identified through Kia; a distinct inventory endpoint was not validated. |

Coverage by make

| Make | Indexed records |
|---|---:|
| Hyundai | 264 |
| Kia | 233 |
| Toyota | 231 |
| MG | 99 |
| GAC | 89 |
| Haval | 88 |
| Suzuki | 83 |
| Mercedes | 76 |
| Jetour | 75 |
| BMW | 70 |
| Nissan | 68 |
| Genesis | 48 |
| Ford | 46 |
| Mazda | 46 |
| Chevrolet | 43 |
| Changan | 42 |
| Land Rover | 40 |
| Lexus | 39 |
| Volkswagen | 38 |
| Renault | 33 |
| Chery | 32 |
| Jeep | 24 |
| Geely | 22 |
| Audi | 20 |
| Mitsubishi | 20 |
| Jaecoo | 18 |
| GMC | 17 |
| Peugeot | 16 |
| Dodge | 15 |
| FAW | 14 |
| JAC | 14 |
| Omoda | 13 |
| Isuzu | 12 |
| Fiat | 11 |
| Honda | 10 |
| Dongfeng | 9 |
| Cadillac | 8 |
| Porsche | 8 |
| Lucid | 7 |
| BAIC | 6 |
| Foton | 6 |
| Great Wall | 6 |
| Hongqi | 6 |
| JMC | 5 |
| Lynk and Co | 5 |
| Maxus | 5 |
| Shineray | 5 |
| CMC | 3 |
| Infiniti | 3 |
| Jaguar | 3 |
| Lincoln | 3 |
| MINI | 3 |
| Soueast | 3 |
| Tesla | 3 |
| BAW | 2 |
| Deepal | 2 |
| Force | 2 |
| ZX Auto | 2 |
| BYD | 1 |
| Exeed | 1 |
| Forthing | 1 |
| Maserati | 1 |
| Sintruck | 1 |
| Volvo | 1 |

Coverage by city

| City | Indexed records |
|---|---:|
| Riyadh | 1619 |
| Al Qurayyat | 215 |
| Jeddah | 161 |
| Dammam | 57 |
| Khobar | 36 |
| Unknown | 25 |
| Abha | 2 |
| Mahayil | 1 |
| Jazan | 1 |
| Buraidah | 1 |
| Jubail | 1 |
| Yanbu | 1 |

Data completeness

| Missing field | Records |
|---|---:|
| trim | 54 |
| mileage | 256 |
| city | 25 |
| image | 24 |

Missing-field counts overlap. In particular, the 256 new records do not provide an odometer value in the collected source data. No zero mileage was invented for these indexed vehicles. Body-style metadata was absent from the collected snapshot, so unsupported body-style choices were replaced with source-backed fuel filters.

Validation

Local suite: **95 tests passed**. Real-data validation: **2,120 records**, **23,320 record assertions**, **869 search cases**, including precision checks and retrieval of observed models. Local in-process search latency: p50 **8.7 ms**, p95 **15.1 ms**. This is not an end-user latency measurement. Production dependency audit reported **0 known vulnerabilities** in 83 dependencies; this is not a penetration test.

The first production run exposed a stalled bulk Haraj path. The next run returned 268 Haraj and 144 OpenSooq records but caught a wheel-only ad. Both failures were fixed rather than lowering the source-volume or quality thresholds.

Remaining limitations

- This is not yet an unrestricted, fully production-ready marketplace. Complete-field coverage is 1,818/2,120 indexed records; incomplete live-source records can also remain incomplete.
- Broad market coverage is partial. Several official dealers and marketplaces remain unconnected for the specific reasons in the registry. Bentley is supplied by live sources, not the collected snapshot.
- Deduplication uses canonical URLs, valid VINs, and exact image plus matching trim/year/mileage/price. Different photos or missing VINs can leave undetected cross-posts. Counts are unique records under those rules, not independently verified physical-car totals.
- Public pages can change, disappear, or show sold stock between refreshes. Refresh is scheduled twice daily, and records expire after 36 hours. The first scheduled GitHub run has not yet been observed.
- Both Render services remain on free plans. A cold-start interstitial was observed; the code cannot provide an always-on guarantee on this plan.
- The existing Render PostgreSQL database is in Frankfurt and expires on 9 October 2026. The read-only SQL probe failed its TLS connection; schema/data health and writes were not verified. Seller PII remains protected by the existing Saudi-residency configuration guard. No database migration or access broadening was performed.
- The checked-in Render Blueprint now describes both roles and local health checks. Existing services were deployed through their GitHub auto-deploy integration; dashboard health-check configuration was not updated through the available connector.
- API throttling is per process; no shared Redis cache or multi-instance rate-limit coordination is configured. CSP retains inline-script compatibility for the existing frontend.
- Browser interaction checks cover search, pagination, sorting and both themes. Native iOS/Android/web bundle builds are checked by CI; physical iPhone/Safari testing was not performed.

Market-depth expansion

The registry now contains 36 sources, including seven independently discovered dealer/showroom/auction leads. `/api/sources` exposes connection method, source type, fresh indexed count, last sync, last successful observation, errors, and a reliability score based on successful page requests divided by attempts in the latest measured sync. Unmeasured sources have a null score. This is an operational sample, not a long-term uptime guarantee. Dealer leads are not double-counted as additional cars.

Dubizzle Saudi remains a priority but is **authorization-required**, with **0 imported vehicles**. Its public HTML contains structured records, but its [Saudi terms](https://help.dubizzle.sa/hc/en-us/articles/4404851931279-What-are-the-terms-of-use) prohibit scraping and commercial reuse without a licence. No public official inventory API was confirmed. Dealer leads were corroborated independently where possible; no third-party scraping service or private endpoint was used. OTM's [own terms](https://www.otm.com.sa/en/terms) require permission for content reuse; its authorized feed is also absent. No dealer was contacted or enrolled.

Production verification

Release `994639713f8c23b0bc481d112ee68e4e8d7d2483` passed all four [GitHub QA jobs](https://github.com/mazinshanti/delilah/actions/runs/35142283678): regression, mobile builds, deployment SHA verification, and production QA including volume and model/filter checks. The live homepage health endpoint reports that exact commit and inventoryLoaded=true. A subsequent additive release contains the expanded source registry and frontend cache fix; its deployment status is reported separately in the delivery message.

Earlier live probes returned 14 Bentley listings for `bently` and 25 Corolla 2013 listings with strict make/year matching. Browser checks confirmed white Day Mode, true-black Night Mode, incremental 24-card pagination and sorting. Scratch HTTP probes observed roughly 11–13 seconds end-to-end including this environment's network route; those timings are not presented as a production user SLA. Thousands of records are validated, but tens of thousands of unique vehicles have **not** been achieved.

Final browser regression: the live title “Bentley Continental GT 2021 Saudi 5.000 KM” exposed a formatted-odometer-as-price defect. Fixed English KM exclusion in the price extractor and dot-thousands parsing in the odometer extractor, with real-title regression tests. Arabic “ماشي 8 الاف كيلو” now yields 8,000 km.
