# Inventory growth — latest follow-up, 22 September 2026

The new pass adds **604 source advertisements**, increasing retained searchable inventory from **5,323 to 5,927**. At measurement, **5,229** were observed within 36 hours and **698** were retained awaiting refresh. Existing advertisements are not removed because a collection timed out. Advertisement uniqueness is not a guarantee of unique physical vehicles.

| Source | New ads in this pass | Stored after pass | Recently observed |
|---|---:|---:|---:|
| CarSwitch Saudi | 397 | 1,479 | 1,153 |
| Haraj | 95 | 95 | 95 |
| ArabWheels Saudi | 69 | 276 | 276 |
| Kayishha | 43 | 220 | 220 |

CarSwitch supplied 624 accepted cards across 26 successful pages, including refreshes, then returned HTTP 202 at page 53. The saved cursor remains 53; this is not an exhaustion or deletion signal. Haraj supplied 95 accepted ads after 154 exact-detail checks across 30 discovery queries; 72 are used and 23 new. One sold ad was rejected; it was not in the prior snapshot. Its next discovery cursor is 30 and pending detail work is preserved. ArabWheels added 69. Kayishha initially timed out, then added 43 through the same public adapter in a separate bounded pass. Motory, Mstaml and SAMACO timed out on this pass; their previous ads and queues remain intact.

Production QA had identified a false alarm for the complete-car title “تويوتا برادو VX 2005 V6 – مكينة موضبة حديثًا”. The live quality check now evaluates the vehicle-sale boundary rather than rejecting any mention of an engine. A regression verifies that actual engine sales, parts and rental titles remain rejected. The minimum Haraj contribution of 150 and the OpenSooq minimum of 60 remain unchanged.

The search matrix also uncovered a real Haraj indexing bug: an ad with its year verified in exact-ad structured metadata could disappear from an exact-year search when its title omitted the year. The collector now preserves this verified-year evidence, and a regression checks both the correct year and a wrong year. No year is inferred from a user query.

## Next measured steps

1. Deploy this validated snapshot and verify production counts and full market QA. Keep searchable and recently observed counts separate.
2. Continue Haraj from cursor 30; finish exact-detail checks for saved pending ads. Track new, refreshed, sold and unresolved records separately.
3. Resume CarSwitch page 53 on the next scheduled pass if the source supplies ordinary inventory again; preserve existing ads on HTTP 202 or other unsuccessful responses.
4. Continue ArabWheels navigation and Kayishha pending ads. Retry timed-out Motory, Mstaml and SAMACO without clearing their saved state.
5. Resolve Syarah page 275 and inspect rejected identity/condition examples before relaxing any parser. Increase coverage only with direct source evidence.
6. Audit OpenSooq, Dubizzle, YallaMotor and dealer feeds for additional obtainable stock after existing queues. Treat a source as added only after accepted ads and a reliable refresh/removal path are demonstrated.

The next goal is **10,000 recently observed ads**, with a measured gap of **4,771**; the longer-term goal remains 50,000. No delivery date or unverified source-capacity estimate is claimed. The existing two-hour collector retains all saved continuation state. `source-pass.json` records the complete measurement and source diagnostics.

## Previous release measurement


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
