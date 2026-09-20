# Directory-wide search and validation — 2026-09-20

Candidate-only change. No production deployment, inventory write, or main merge.

## Problem addressed
The inventory trial supported five detail parsers. The separate 39-target discovery directory searched more sites but never validated its results, and its URL extractor discarded unsupported routes on known hosts. These were different operations, not complete market coverage.

## Implemented
- One read-only session searches every directory target and two unrestricted Arabic/English web tasks, preserving the original query constraints.
- Two concurrent provider searches by default; source verification uses existing per-origin pacing, robots and evidence gates.
- Search continues when a source returns nothing. Per-task completion, failed tasks, pending detail URLs and pages are persisted for continuation.
- Grounded URLs on unknown hosts and unsupported known routes are retained for review, without accepting generated answer URLs or admitting unsupported inventory.
- Existing supported advertisements are validated as discovery batches arrive. A global per-run detail budget does not stop discovery of other sources.
- Added public-evidence-backed discovery targets Mstaml and Expatriates Saudi Vehicles: 41 directory targets and 43 search tasks. These are NOT 41 working inventory connectors.
- Existing directory-only command now uses the uncoupled URL extractor too.

## Source checks
- https://www.mstaml.com/ — public category and Saudi vehicle ads observed; mixed countries and non-vehicle categories require explicit geography and vehicle checks.
- https://www.expatriates.com/classifieds/saudi-arabia/vehicles-cars-trucks/ — public Saudi vehicle category observed; includes wanted/scrap/services, lease-transfer numbers and malformed asking prices. No automatic ingestion added.
- Autozone, ALJ Used Cars, Budget and Lumi candidate addresses did not return usable evidence in this check and were not presented as verified additions.

## Validation and limits
439 automated tests passed (including six new pipeline tests). New tests cover all targets, unrestricted open tasks, bounded concurrency, unsupported-source retention, hard price filters, checkpoint recovery and no duplicate rereads. Provider responses are mocked in automated tests. The current workspace has no OpenAI API key, so a live 43-task provider run has NOT been performed. No speed or coverage percentage is claimed.

Existing inventory detail admission remains five supported parsers. Saleh/OpenSooq and other sources still require safe detail integration before this trial can admit their ads. The production site remains unchanged. The user request for all sources in production is therefore not complete.

## Run in an authenticated environment with this candidate checkout

```sh
node scripts/ai-all-sources-session.mjs 'Toyota Corolla' /tmp/dalelah-all-sources-corolla.json
```

Defaults: all 43 search tasks, at most 60 detail checks, two provider calls concurrently; each call permits at most two web-search tool calls. Results are read-only. Re-running resumes incomplete tasks and pending detail/page work. To process pending work without further web search:

```sh
node scripts/ai-all-sources-session.mjs 'Toyota Corolla' /tmp/dalelah-all-sources-corolla.json 0 60
```

Use a new checkpoint path when changing the query, filters, intent or directory plan. A completed directory pass does not mean the entire market was covered. Saved listings are historical trial observations, not refreshed production inventory.
