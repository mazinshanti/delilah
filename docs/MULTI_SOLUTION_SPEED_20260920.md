# Multiple search latency fixes

Candidate branch only. No production deployment.

1. Existing bounded source-response caching and identical-request sharing remain active (previous change).
2. A direct-ad worker now overlaps independent inventory-page traversal within the configured concurrency cap. A stalled direct source no longer blocks the first accepted result from a faster category/detail source. With no pending direct ads, all worker slots remain available to pages. Detail budgets are reserved synchronously and pending coverage is preserved.
3. Identical directory discovery tasks share one provider request and reuse completed discovery for a fixed 30-second TTL, bounded to 100 entries. Query and source identity are part of the key. Failed requests are never cached; returned data is cloned. Cache/shared responses report zero extra provider calls. Validation and user constraints still run independently.

458 tests passed. The prior test requiring category traversal to start only after a direct result was replaced with the stronger user-visible assertion that a direct accepted result is emitted while slow category traversal is pending. A converse test verifies that a fast category/detail result arrives while a direct source is stalled, without increasing the concurrency limit. Query/source cache separation and retry behavior are tested.

Live workspace sample: Nissan Patrol, one observed Haraj detail plus Syarah category, concurrency 2, three detail checks, one category-page budget. Thirteen ad URLs discovered; three checked and accepted; first result at 18.957 seconds, total 40.710 seconds, ten details and one pagination URL pending. No provider calls. This is not a paired before/after benchmark, not a Render/browser timing, and not proof that cold search is ready to ship. Do not compare it as a speedup against the previous different Mstaml request.

Production integration and end-to-end Render/mobile/desktop validation remain outstanding. The current Render connector exposes resource management and logs, not arbitrary shell execution; no production benchmark command was run through it. Existing production search is unchanged.

Evidence: qa-20260920/multi-source-overlap-speed.json.
