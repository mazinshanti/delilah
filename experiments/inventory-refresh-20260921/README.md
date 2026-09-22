# Incremental refresh candidate — 21 September 2026

Implemented on experiment/live-search-20260921; not activated on production. Existing GitHub schedule remains every two hours. A 30-minute discovery eligibility interval does not cause a job to run every 30 minutes.

Changes to existing additional-stock adapters (Mstaml, Motory, ArabWheels, Kayishha, SAMACO):
- Successful unchanged details become due after 24 hours; changed fields or explicitly high-priority rows after four hours. No automatic popularity tracking is claimed.
- Most recent attempt and last successful validation are separate. Error retries back off from one hour to 24 hours; failure does not advance lastSuccessfulAt.
- HTTP 401/403/429 pauses the source across saved runs, honoring numeric Retry-After up to 24 hours with a one-hour floor.
- Existing confirmed sold/404/410 removal remains; network failures never mark a listing sold.
- Entry discovery is eligible after 30 minutes; broad sitemap discovery remains 12 hours.
- Snapshot/state writes use atomic replacement. The validated snapshot is saved before its successful crawl state. These are two files, not a transactional database.
- Workflow exports the freshness report and writes refreshed data to the branch it ran on, rather than hard-coding main for manual experiment runs.

Report generated from the local committed snapshot dated 2026-09-20T14:03:29Z: 3,521 raw/valid rows, 3,046 fresh deduplicated listings, 475 stale rows at the report time. This is not a current production audit and does not guarantee unique physical vehicles. Freshness is 36 hours, consistent with the serving index. Remaining gap to 50,000 was 46,954. Source-level counts and queue backlog are in baseline.json.

Validation: 512 repository tests passed, including additional cases for price changes, retry persistence, source cooldown and preservation of successful timestamps. Bounded live probe: two sources, 15-second budget each, at most two details, one page and one sitemap. Both exhausted their time budgets before accepting any listings. No production snapshot was modified. See live-probe.json. This proves neither coverage growth nor achievable refresh throughput.

Remaining: validate longer bounded runs, confirm actual scheduled workflow health, measure requests/source yield and processing capacity, then activate the candidate refresh code through a reviewed production rollout. Existing bulk and Haraj collectors retain their own scheduling; four-hour detail prioritization currently applies only to the additional-stock frontier. Git-backed compressed snapshots remain the current storage; moving to a compact durable database is a separate step.

Commands:
- node scripts/inventory-refresh-report.mjs
- node --test tests/stock-frontier.test.mjs tests/additional-stock.test.mjs
- node scripts/collect-market-inventory.mjs (network collection; uses existing environment budgets)
