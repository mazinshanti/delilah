# Read-only multi-brand market session

Run `node scripts/ai-market-session.mjs /tmp/dalelah-ai-market-session.json` from a checkout of this candidate branch with the existing OPENAI_API_KEY environment variable. Default web model is gpt-5-mini. No inventory writes, no production activation.

Twelve searches: Arabic/English Corolla; Elantra; Patrol; BMW X5; Mercedes C-Class; Ford F-150; Porsche 911; MG ZS; explicitly new Corolla; explicitly used Corolla; Arabic Land Cruiser 2023. Segment labels describe the test basket, not inferred vehicle attributes or extra search constraints.

Each search uses two discovery rounds, at most 24 detail checks, and at most four provider web tool calls. Session ceiling: 288 detail checks and 48 web tool calls. Round one scopes web discovery to Haraj/Syarah; round two to CarSwitch/Saudi Sale, plus Mercedes for a Mercedes query. This source scheduling concerns discovery, not result ranking. It does not guarantee the provider returns advertisements from every allowed domain.

The current trial has five validated route adapters. Saleh, OpenSooq and other registry sources are explicitly reported as outside this AI trial; they are not silently enabled or counted as searched. An independent source accessibility probe must not be described as an AI discovery test.

A successful detail-page cache is shared across searches with a 20 MB cap. Failed requests are not cached. Existing robots pacing, restricted-source pauses, exact-listing identity checks, hard query filters, and ranking remain active. The benchmark executes cases sequentially. Whole-session counts deduplicate canonical source advertisement IDs across queries, including Arabic/English overlap. They do not claim cross-marketplace deduplication of the same physical vehicle without supporting identity.

Progress prints accepted listings and each completed query. The JSON report is checkpointed after every query and includes unique discovered/checked/accepted counts, source totals, compact listing records, per-query rejection reasons, cache hits, and elapsed time. Image URL availability is reported separately from image HTTP success, which remains unmeasured. A zero result is not proof of zero inventory at a source. Coverage is always marked incomplete.

The report includes the source-registry limitations for untested adapters. Never add advertised marketplace inventory totals to measured accepted counts. This benchmark is not a production rollout or a mobile/desktop regression certification.

## User-run AI session and route repairs

The completed Render session reported 113 unique discovered, 108 unique checked and 25 unique accepted source advertisements in 463,654 ms. Accepted by source: CarSwitch 19, Haraj 4, Syarah 2, Saudi Sale 0, Mercedes 0. This is distinct from the earlier direct-source audit of 27 records. Image HTTP checks were not run.

The provider found Haraj `/en/<id>/...` advertisements, Saudi Sale `/index.php/[en/]listings/<id>/...`, Syarah model inventory pages, Saudi Sale `car-models` pages, and double-encoded Arabic CarSwitch category URLs which the trial route allowlist excluded. The repaired trial normalizes Haraj language aliases to its existing numeric route, matches Saudi Sale ads by stable source ID across locale/front-controller prefixes, and admits the observed inventory categories for traversal only. Editorial, price-guide, Haraj pic/tag spam, model-catalog/new-car configuration pages and unrelated classifieds remain excluded. Category links still undergo independent exact-ad validation.

Saudi Sale detail pages inspected live lacked JSON-LD. The new isolated detail reader requires a matching canonical source ID, an explicit new/used condition in the page title, and make/model/year from the primary `car-details1-container` specification table. It reads price and mileage only from their exact labeled rows. Warranty, monthly payment strings, other page sections and related ads cannot supply those numbers. Unknown condition fails closed; no inference from zero mileage. This reader is imported only by the experimental discovery module, not the production ingestion chain.

Live regression: the previously rejected Syarah `/en/autos/mg/zs` category produced 12 direct candidate links. Saudi Sale ad 8786aC yielded one Toyota Corolla 2026 new record with SAR 69,300 and 0 km from its labeled specification rows. Haraj English ad 11174107507 reached canonical detail validation but still failed `missing_title_year`; accepting the URL does not guarantee accepting the advertisement. Full post-change suite: 385 passed, 0 failed. No new full-provider session or production deployment is claimed.

Additional live checks after repair: Haraj English ad 11177215678 passed route discovery but was rejected for unknown condition. Saudi Sale used Audi ad sa591B still returned no-exact-vehicle-evidence. The new Saudi Sale detail reader is therefore proven on the sampled new Corolla, not certified across all source templates or used listings. These remaining failures are not added to accepted counts.


## Faster progressive trial and bounded deeper traversal

The experimental orchestrator now checks a small first batch of direct advertisements before traversing inventory pages and emits each accepted result immediately. Independent sources can be checked by up to three workers. The shared detail reader serializes requests per origin, including robots loading, source pacing and redirects; a restricted source remains paused. The session HTML cache uses canonical source-ad identity across locale URLs, retains its 20 MB cap, and never caches failed fetches.

Inventory-page work is shared across available sources and rounds. The reader follows only an actual next-page anchor from the source HTML: same origin, same normalized inventory path, only a numeric `page` parameter, at most page 20. It does not manufacture page URLs or treat page links as cars. Default maximum is six discovery pages per search, shared across rounds; unvisited pages and detail URLs remain visible in the summary. These are experiment limits, not advertised market inventory totals. Pagination using JavaScript, cursors or different route shapes is not covered by this change.

Validation: full suite 388 passed, including early-result ordering, overlapping independent sources, serial same-origin requests, single robots fetch per origin, bounded pagination, rejected external pagination links, exact identity and hard query filters. Live before/after source-read timing is recorded separately; it excludes AI provider latency and does not establish production latency or market coverage. Production integration and a full Render AI rerun are still pending.

Live timing sample (three fixed ads, one each from Haraj/Syarah/CarSwitch, sequential before/after runs, separate reader instances, no provider search): before 68,040 ms total / 23,840 ms first accepted; after 23,600 ms total / 20,497 ms first accepted. Both runs checked and accepted the same three source ads. The observed source-reading total fell about 65%; first-result time fell about 14%. A single sample is sensitive to network/source caching and is not a production SLA. Raw sample: `docs/market-speed-sample-20260919.json`.
