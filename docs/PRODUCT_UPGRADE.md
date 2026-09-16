# Dalelah product upgrade — September 2026

The existing front/deep-search services and APIs remain in place. No listings are generated from the identity catalog.

## Implemented

- Search-first Arabic homepage, English/LTR switch, white/true-black themes, natural-language budget/city/condition extraction, complete catalog dropdowns, and prominent selling navigation.
- Shared browser/server identity catalog: 100 makes, 1,544 model entries. Current Saudi-market names and relevant discontinued models include Pontiac G8. Unknown or unavailable searches never fall back to other makes.
- 96 manufacturer-logo assets with provenance, local delivery and consistent proportions. BAW, Deepal, Jaecoo and Tank retain text because an appropriate asset could not be verified. Trademark identification does not imply affiliation or an official distribution license.
- Backward-compatible image galleries in normalization, ingestion, merging, cards and vehicle details. Syarah's published image arrays are preserved. Public listing metadata can enrich Haraj, Syarah and CarSwitch galleries with bounded requests and robots checks.
- The measured Haraj example improves from a 140×140 search thumbnail to a 900×1200 original, with 11 published images. See `haraj-image-quality.json`; this is measured sample evidence, not a guarantee for every listing.
- Two-step bilingual seller form, ten-photo limit, local preview/reorder/remove, server-side decoding and resizing, metadata stripping, validation, rate limits, origin checking and parameterized SQL. Submission and photos commit in one transaction. Request IDs prevent duplicate submissions on retry. References disclose status, not contact details.
- Idempotent PostgreSQL schema migration preserves existing submission columns and adds a private photo table. No seller data is written to public inventory or local server files.

## Verification

112 tests pass, including every catalog entry's canonical recognition, strict searches for each of the 100 makes, New/Used separation, exact years, Arabic aliases, zero-result Pontiac searches, unsafe gallery URLs, photo decoding/deduplication and the seller HTTP journey against embedded PostgreSQL. Production verification additionally caught an Arabic exhaust-gasket ad and a harmless Haraj trailing-slash redirect; both now have regression coverage. Database tests cover successful persistence, duplicate requests, validation errors and transaction rollback. Production dependencies have zero reported npm-audit vulnerabilities at verification time.

`product-upgrade-metrics.json` records the inventory snapshot, gallery coverage and per-make catalog counts. The live release is checked separately after Render deployment; passing local tests alone does not establish production readiness.

## Remaining limits

Production seller storage is not configured: `SAUDI_DATABASE_URL` is absent. Existing Saudi data-residency requirements remain enforced. The form explicitly reports unavailability and cannot claim successful submission. A production seller-persistence test is therefore blocked.

This is a curated catalog, not proof of exhaustive worldwide historical coverage. Arabic aliases are strongest for Saudi-market models. Some source listings have only one photo or no photo; source timeouts retain existing images. The index continues to expire stale records after 36 hours; a bounded refresh is not a promise of perpetual freshness. Physical iPhone/Android viewport testing is not established by the local unit suite.
