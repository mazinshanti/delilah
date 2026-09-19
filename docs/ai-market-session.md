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
