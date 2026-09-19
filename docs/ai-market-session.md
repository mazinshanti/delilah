# Read-only multi-brand market session

Run `node scripts/ai-market-session.mjs /tmp/dalelah-ai-market-session.json` from a checkout of this candidate branch with the existing OPENAI_API_KEY environment variable. Default web model is gpt-5-mini. No inventory writes, no production activation.

Twelve searches: Arabic/English Corolla; Elantra; Patrol; BMW X5; Mercedes C-Class; Ford F-150; Porsche 911; MG ZS; explicitly new Corolla; explicitly used Corolla; Arabic Land Cruiser 2023. Segment labels describe the test basket, not inferred vehicle attributes or extra search constraints.

Each search uses two discovery rounds, at most 24 detail checks, and at most four provider web tool calls. Session ceiling: 288 detail checks and 48 web tool calls. Round one scopes web discovery to Haraj/Syarah; round two to CarSwitch/Saudi Sale, plus Mercedes for a Mercedes query. This source scheduling concerns discovery, not result ranking. It does not guarantee the provider returns advertisements from every allowed domain.

The current trial has five validated route adapters. Saleh, OpenSooq and other registry sources are explicitly reported as outside this AI trial; they are not silently enabled or counted as searched. An independent source accessibility probe must not be described as an AI discovery test.

A successful detail-page cache is shared across searches with a 20 MB cap. Failed requests are not cached. Existing robots pacing, restricted-source pauses, exact-listing identity checks, hard query filters, and ranking remain active. The benchmark executes cases sequentially. Whole-session counts deduplicate canonical source advertisement IDs across queries, including Arabic/English overlap. They do not claim cross-marketplace deduplication of the same physical vehicle without supporting identity.

Progress prints accepted listings and each completed query. The JSON report is checkpointed after every query and includes unique discovered/checked/accepted counts, source totals, compact listing records, per-query rejection reasons, cache hits, and elapsed time. Image URL availability is reported separately from image HTTP success, which remains unmeasured. A zero result is not proof of zero inventory at a source. Coverage is always marked incomplete.

The report includes the source-registry limitations for untested adapters. Never add advertised marketplace inventory totals to measured accepted counts. This benchmark is not a production rollout or a mobile/desktop regression certification.
