# Verified inventory expansion — 2026-09-21

This is an isolated candidate on the experiment branch. It does not change the production snapshot, production services, or the on-demand preview's inventory routes.

## Changes

- Expanded scheduled discovery can follow source-published make/model stock navigation, with same-origin route checks, bounded queues, robots rules and request pacing. It never constructs ad URLs.
- A published sitemap returning 404/410 no longer blocks other discovery queues. Authentication failures, blocks and throttling still stop collection; there is no bypass.
- Optional `links-only` media mode preserves source image URLs without downloading or archiving images. Image verification is explicitly false for these additions. Default existing collector behavior remains unchanged.
- Exact-detail additions carry the time and level of detail evidence. Source inventory cards are reported separately and are not presented as individual detail rechecks.
- Expansion saves resume state, atomic candidate snapshots and per-source recovery checkpoints. Previously failed details are backed off; confirmed unavailable ads are removed. Missing ads on an incomplete scan are not assumed sold.
- Bulk refresh applies the source's crawl delay once per request, removing a redundant second delay, and retains a cursor for the next bounded run.

## Reproduce

Run `node scripts/expand-verified-inventory.mjs` to resume the additional sources, then `node scripts/refresh-primary-candidate.mjs` to resume Syarah and CarSwitch. Do not run these two snapshot writers concurrently. Both write under this experiment directory, never `data/market-inventory.json.gz`. `EXPANSION_SOURCES`, `EXPANSION_DETAILS` and `EXPANSION_DURATION_MS` bound the additional-source pass. New sources requiring permission are not enabled.

Run `node scripts/validate-expanded-candidate.mjs` for candidate identity, condition, Arabic/English matching and strict budget checks. Read `final-report.json` and `validation.json` for the latest measured counts; discovered URLs and stale records do not count toward the 10,000-fresh-listing target. These are ads, not a guarantee of distinct physical vehicles.

## Validation

527 repository tests and 27 experiment tests passed. New regression checks cover metadata-only collection, observed brand navigation, and recovery from deleted sitemaps. The API integration test now uses the snapshot's own time in its child process, so a source snapshot aging past 36 hours cannot break unrelated API tests. Production freshness rules are unchanged. Candidate data is separately checked at actual current time.

Only text metadata and original-source media links are retained. No image or HTML archive is committed, and no paid search provider was used.

## Measured outcome at 2026-09-21 14:42 UTC

- Stored candidate: 4,473 ads versus 3,521 in the baseline; net addition 952.
- Fresh, deduplicated and displayable: 3,669 ads (3,010 used and 659 new). The other 804 stored ads are stale and excluded from the target.
- Evidence: 441 current exact-detail records, plus 3,228 current source inventory-card records.
- Fresh source counts: Syarah 2,580; CarSwitch 648; Kayishha 177; ArabWheels 132; Mstaml 67; Motory 44; SAMACO 21.
- Unknown prices remain unknown; 1,082 ads passed the SAR 50,000 filter. Arabic and English Toyota Corolla searches returned the same 44 ads.
- Candidate compressed metadata occupies about 1 MB, plus about 37 KB of crawl state. Images stay on their original sources.
- 10,000 fresh ads has not been reached; 6,331 remain. Future runs must refresh existing ads as well as discover new ones. There is no guarantee all pending URLs will qualify.

The first two additional-source passes contributed 375 net new ads; primary-source collection contributed 555; the final Motory recovery added another 22. A deleted sitemap was skipped, but failed or blocked pages were not bypassed. The primary-source cursors and per-source queues are retained for continuation.
