# Live search v2 — search-engine lessons applied

Experimental branch only. No production routes, UI, connectors, inventory snapshots, scheduled collectors, or hosting settings are changed.

## Research and design

Google separates discovery/crawling, indexing, and serving. It does not fetch the entire web at query time. It also groups canonical duplicates and limits crawl rates. Reference: https://developers.google.com/search/docs/fundamentals/how-search-works

For Dalelah's no-local-inventory objective, an external provider's index can perform discovery. Tavily supports domain restrictions and returning URLs without generated answers or full-page content. Reference: https://docs.tavily.com/documentation/api-reference/endpoint/search

These principles informed the implementation; this is not a claim that the prototype reproduces Google's ranking algorithm or market coverage.

## Changes from v1

- Separate discovery eligibility from final acceptance. Unknown prices/locations may be investigated; known conflicts are rejected. Final budget, condition, city, body, year, model and origin constraints still apply.
- Replace broad make-only Japanese SUV searches with a bounded model expansion: Toyota Fortuner, Nissan X-Trail, Mazda CX-9. This is a sample, not exhaustive market coverage or a recommendation of those models.
- Add CarSwitch live category discovery and exact-detail Car/Vehicle schema parsing, including array-valued types and brands. Detail recommendations cannot supply another car's facts.
- Use Syarah's exact vehicle schema for detail validation. Its filter UI returned no server-rendered cars in the probe, so new-car discovery follows an observed same-category pagination link instead. The bounded trial samples the last linked page (maximum page 20); it does not manufacture page/ad URLs or claim all pages were searched.
- Inspect Saleh's live sitemap and exact product pages without copying its inventory. Unknown condition/price stays unknown and fails a constrained query.
- Emit verified results progressively instead of waiting for every source.
- Cap requests at six concurrent overall and two per host; detail work at four workers, at most two per source, and twelve attempts; retrieval at 45 seconds. Redirects share a per-request timeout and preserve source/ad identity.
- Canonical source/ad IDs deduplicate URL variants. Interleave accepted sources without admitting worse matches to fill a quota. This does not guarantee cross-source duplicate-vehicle detection.
- Cache only successful normalized result sets for 60 seconds, maximum 16 entries and 2 MB. No persisted cache, HTML, image files or inventory database. The process still consumes temporary RAM and network bandwidth. HTML is discarded after parsing.
- Reuse the project's earlier hosted web-search experiment via `OPENAI_API_KEY`. An optional Tavily adapter uses `TAVILY_API_KEY` when OpenAI is not configured. These adapters return only supported, source-bound ad URLs; never accepts snippet prices as evidence. No paid account was created. The live trial reports whether the adapter was configured.

## How to run

```sh
node --test experiments/live-search-v2/core.test.mjs
node experiments/live-search-v2/run.mjs
# Optional single case:
TRIAL_CASE=corolla-en node experiments/live-search-v2/run.mjs
```

The runner reuses production's AI interpretation via a normal search request; returned production cars never enter the experimental lane. This request also runs existing production search, so the harness is not an independent inventory-free AI endpoint. Interpretation happens before the measured live-retrieval timer. Baseline count is an initial response, not a complete-market count.

Production AI, hosted discovery, upstream source access, and network location affect the eventual deployed latency/cost. Workspace measurements are not a production performance guarantee. Warm-cache timings exclude intent parsing, network round trips from a user and rendering.

## Verification

Fifteen targeted tests cover unknown fields, hard constraints, exact-ad identity, unavailable/foreign-currency listings, source diversity, redirect safety, bounded cache expiry, progressive results, deadlines and hosted discovery trust boundaries. All passed. The 45 existing direct-search/AI-intent tests also passed.

OpenSooq remains unchanged in production. It is omitted from v2's experimental retrieval while the exact-detail reader remains unsupported; v1's candidate discovery is not reclassified as verified stock.

The source scheduler reserves verification capacity for independent sources. Stable Haraj ID routes reuse existing project behavior to avoid title-slug redirects. Same-ad Syarah search cards may supply a missing city, explicitly labelled as card evidence; detail facts never come from an unrelated recommendation.

## Live measurements — 21 September 2026

| Query | Original experiment verified ads | v2 verified ads | v2 first verified result | v2 retrieval stop |
|---|---:|---:|---:|---:|
| Used Corolla <= SAR 45k, Jeddah | 0 | 4 | 22,329 ms | 45,007 ms |
| Japanese family SUV <= SAR 150k, Riyadh | 1 | 7 | 19,836 ms | 45,008 ms |
| New Corolla <= SAR 100k | 0 | 0 | none | 22,801 ms |

Original comparison: `../live-search-20260921/corrected-results.json`. v2 measurements: `results.json`. These are separate live runs with changed source coverage, budgets and source conditions, not controlled production A/B tests. The first two v2 runs reached the 45-second budget, so additional pending candidates were not exhausted.

Corolla results came from CarSwitch; SUV results came from Syarah (4) and CarSwitch (3). SUV samples in this run were Fortuners; the bounded query expansion is not comprehensive coverage of Japanese SUVs. There are 11 accepted source ads across these two distinct queries; this does not establish uniqueness of physical cars across marketplaces.

An earlier v2 pass let slow requests occupy workers waiting on the same host. Corolla yielded 2 ads with firstResultMs 42,633. Per-source worker limits plus stable Haraj ID fetching improved the later observed first result to 22,329 ms and yielded 4 ads. Multiple changes and network variation prevent attributing the whole improvement to any single change. Earlier run: `before-scheduling-fix.json`.

Immediate in-process repeats returned the same 4 and 7 matches in 0–1 ms with zero additional source requests. These timings exclude production AI interpretation, user-to-server latency and rendering. This demonstrates the cache path, not a production response-time SLA.

The new-car case remains unresolved. Saleh supplied two relevant product URLs but insufficient price/condition evidence to pass; Syarah's filter UI and a separately observed last pagination link returned no parseable stock in these probes. The dedicated pagination run (`new-pagination-results.json`) also accepted zero. Nothing was admitted merely because the user requested “new.”

Hosted discovery was **not configured locally**. Its adapters passed mocked trust-boundary tests only. Live source discovery in the measured run used source category pages/sitemaps. Existing production AI supplied intent; its baseline result cars were excluded. No end-to-end independent hosted-discovery efficacy or per-search provider cost is claimed.

## Release decision

Keep this experiment isolated. Used-car retrieval coverage improved, but cold first results remain around 20–22 seconds here, new-car recall is still inadequate, and independent hosted web discovery needs a run in an environment with the existing OpenAI key. A production-region latency test, request cost measurement and broader query/source validation are still required. Production was not deployed or modified.
