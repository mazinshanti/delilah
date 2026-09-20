# Speed and source refinement — 2026-09-20

Candidate only; production is not changed by this commit.

## Implemented
- A ten-minute, 1,000-entry cache of validated listings in the isolated market benchmark. Canonical listing IDs deduplicate locale variants. All query, condition, price, mileage and intent constraints are reapplied. Reads never extend freshness. Cached listings emit before AI discovery and are not refetched or counted as fresh checks.
- Exact-ad Haraj structured price: agreeing input/formatted numeric fields, conservative cash-price bounds, conflicting text rejected, finance-only and multiple-trim offers excluded.
- Exact-ad Haraj imagesList originals preferred before HTML gallery extraction. No constructed original URLs or unrelated fallback images.
- Observed Haraj /search/ routes can supply bounded detail links. They are never accepted as inventory. Existing robots, origin, budget and vehicle classification checks remain.

## Verification
402 automated tests passed, zero failures. Coverage includes cache expiry and constraints, early cached results, no redundant fetch, exact gallery association, hostile image URLs, structured price conflicts and search-page/detail separation.
Live Haraj search for Toyota Corolla yielded 21 observed detail links, not 21 accepted cars.
Live Haraj ad 11180904394 yielded its exact 59,000 SAR structured asking price and eight gallery URLs. The first gallery image was downloaded and decoded at 900 x 900 pixels. No claim is made that every gallery URL was checked.

## Limits and remaining gates
The most recent user-run full benchmark was 57 accepted unique listings from 157 checks in 434,211 ms, with incomplete coverage. This is the pre-change baseline. A new provider-backed cold/warm benchmark has not run: provider credentials and execution are available in the user Render shell, not this workspace. Cold-search latency and additional sources remain unresolved. The new cache currently belongs to the isolated trial runner; no production integration or deployment has been performed. Main merge requires full production regression and deployment verification, including Arabic/English and desktop/mobile.

The runner uses OUTPUT.validated-cache.json, retaining results across runs with the same output path. Report cachedAccepted separately from fresh checked/accepted metrics; do not interpret cache hits as newly discovered inventory.
