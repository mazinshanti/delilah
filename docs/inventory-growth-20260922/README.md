# Inventory growth and release — 22 September 2026

The latest completed collection increased the candidate from 4,473 to 5,323 stored advertisements (+850). This comprises 175 additional ads from Mstaml, Motory and ArabWheels and 675 from continuing Syarah's published inventory pages. These are source advertisements, not a guarantee of unique physical cars. At the collection measurement, 4,517 were observed within 36 hours and 806 were retained awaiting refresh. No timestamp was renewed simply to increase this count.

| Source | Stored ads | Recently observed at measurement |
|---|---:|---:|
| Syarah | 3,600 | 3,253 |
| CarSwitch Saudi | 1,082 | 648 |
| ArabWheels Saudi | 207 | 207 |
| Kayishha | 177 | 177 |
| Motory | 122 | 122 |
| Mstaml | 89 | 89 |
| Mercedes-Benz Saudi | 24 | 0 |
| SAMACO Automotive | 21 | 21 |
| Saudi Sale | 1 | 0 |

CarSwitch's current attempt timed out reading robots.txt and added no records. Kayishha's attempt also timed out. Neither failure removes previously collected ads. Current pending queues and bulk pagination cursors are included in the release snapshot. A source being listed in the registry is not counted as a successful connection.

## Execution plan

1. Publish retention behavior with this validated inventory and saved cursors. Retain old ads with a refresh-due label until a source confirms sale or removal; maintain separate freshness counters.
2. Continue the existing two-hour scheduled collector. Enable source-published make/model discovery and metadata-only collection for the additional sources. Preserve pagination and bounded retries so the next run advances rather than repeatedly scanning page one.
3. Investigate Syarah's unparseable page 275 without treating it as proof that inventory is exhausted; resume its saved cursor, Motory's make/model queues, and ArabWheels' queued pages. Recheck old ads as well as discovering new ones. Keep exact identity, condition, price and junk filters.
4. Retry CarSwitch and Kayishha through their existing public adapters after transient errors. Diagnose response or parsing failures; do not bypass source restrictions or count failed requests as listings.
5. Review rejected identity and sale-evidence samples individually, then add source-wide parsing improvements with regression cases. Do not waive all validation or classify rejected records as duplicates.
6. Audit Dubizzle, YallaMotor, OpenSooq and dealer feeds for incremental obtainable stock after existing queues are processed. A new source must demonstrate real accepted ads and a reliable refresh/removal path before contributing to targets.

The next milestone remains 10,000 valid, recently observed ads: the measured gap is 5,483. The searchable retained count is 5,323, a separate metric. The long-term goal is 50,000; no date or source-capacity guarantee is claimed. Each collection should report discovered, attempted, accepted, new, refreshed, removed, unresolved, and refresh-due totals by source.

## Release scope and verification

Release is based on production main, with only inventory refresh/discovery, retention, city/Arabic matching fixes, and the collected snapshot promoted. The separate on-demand preview and paid-search settings are not activated. Local production-branch tests and record/search validation are run before release; browser regression runs in GitHub because this local environment denies Chromium sockets. GitHub QA includes Arabic/English desktop/mobile checks before merging.

Syarah returned no parseable records at page 275. The cursor is retained at that page, with an unresolved diagnostic rather than a confirmed end-of-inventory claim.
