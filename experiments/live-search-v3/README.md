# Dalelah on-demand search: expanded experiment

Isolated on `experiment/live-search-20260921`. No production deployment or production code changes.

## Expansion

- Eight experimental adapters: Haraj, CarSwitch Saudi, Syarah, Saleh Cars, plus Saudi Sale, Motory, SAMACO Automotive and ArabWheels Saudi. Adapter presence is not evidence that every source contributes accepted listings.
- Broad vehicle requests expand to up to six catalog-backed make/model searches, preserving body type, origin and excluded makes. Explicit model requests remain exact. The Japanese SUV basket now includes Fortuner, X-Trail, CX-9, CR-V, Pajero and RX.
- Six live query cases cover Arabic and English, budget/city constraints, used sedans/SUVs and two new-car queries.
- Added sources respect robots rules, serialize same-origin requests with crawl delays, pause on access restrictions, and validate exact source-ad identity. Failed robots requests are retryable. Discovery hints from URL slugs reject known off-query candidates; they never supply final vehicle facts.
- Verification requests take priority over queued category work. Added-source robots requests are started early to reduce starvation from the expanded query fan-out.

## Resource bounds and evidence

Six concurrent network calls globally, two per host, four verification workers and at most two workers per source. This run permits 18 detail attempts and a 60-second retrieval budget; v2 used 12 and 45 seconds. Timings are not a controlled speed comparison. Each source gets at most six detail attempts. All runs remain partial, not complete market searches.

Pages are fetched and processed transiently in memory; zero bandwidth or zero memory use is not claimed. No inventory archive, model download or image files are stored by the experiment. The in-memory successful-result cache is capped at 2 MB / 16 entries, expiring after 60 seconds. Diagnostic reports contain compact result records and image URLs, not page/image bodies.

Hosted AI/web-search discovery remains unconfigured in this local environment. Provider trust boundaries are tested with mocks. The live run uses source category pages and the existing production endpoint for intent only; its returned inventory is excluded. API cost and hosted-search efficacy have not been measured.

## Verification

19 experiment tests passed. Also passed: 45 direct-search/AI-intent tests, 50 discovery/Saudi Sale tests, and 11 additional-stock tests (125 total). The additional-stock suite initially could not load its existing `sharp` dependency; linking the runtime-installed package resolved that environment issue. No dependency or production file changes were required.

Run the experiment with:

```sh
node --test experiments/live-search-v3/core.test.mjs
node experiments/live-search-v3/run.mjs
TRIAL_CASE=new-ar TRIAL_REPORT=new-retry.json node experiments/live-search-v3/run.mjs
```

## Measurements

| Query | Verified source ads | First result | Sources |
|---|---:|---:|---|
| Toyota Corolla under 45000 in Jeddah | 3 | 25.67 s | CarSwitch Saudi: 3 |
| ابي جيب عائلي ياباني تحت 150 ألف في الرياض | 6 | 30.90 s | Syarah: 4, CarSwitch Saudi: 2 |
| تويوتا كورولا جديدة تحت 100 ألف | 0 | none | none |
| Toyota Camry under 80000 in Riyadh | 5 | 23.25 s | Syarah: 3, CarSwitch Saudi: 1, Haraj: 1 |
| Audi Q8 under 300000 | 7 | 25.68 s | Syarah: 1, Motory: 2, CarSwitch Saudi: 3, ArabWheels Saudi: 1 |
| Hyundai Elantra new under 100000 | 3 | 35.76 s | Motory: 3 |

Measurements dated 21 September 2026. All completed retrievals reached the 60-second budget. First-result times exclude production intent interpretation, user network and rendering. Immediate in-process warm repeats took 0–1 ms with no additional source calls; this is not an end-to-end latency claim.

`results.json` preserves the initial six-case basket before the scheduling/filter fixes. Its Corolla intent request failed at transport, so `corolla-retry.json` provides the completed Corolla row above. `new-retry.json` reruns new Corolla after the fixes and still returns zero. The expanded SUV query returned six ads versus seven in the earlier v2 sample despite its larger budget; broader discovery did not establish better recall or speed for that case.

The table contains 24 distinct source-ad identities across five successful queries and five contributing sources. Six ads came from added adapters: Motory (five) and ArabWheels (one). Distinct ad IDs do not establish distinct physical vehicles: the two Motory Audi ads share model/year/price and may represent duplicate stock. Saudi Sale discovery worked but inspected detail requests returned HTTP 202; SAMACO did not complete within this run. Neither is counted as a contributing source.

New Elantra matched three Motory ads with explicit new condition, one-kilometre odometers and asking prices SAR 71,300, 75,325 and 78,000. New Corolla remains unresolved: discovered pages did not produce sufficient matching exact-ad evidence within the budget. A zero result is not evidence that no matching car exists in the market.

## Release decision

Keep this isolated. Expansion demonstrated additional source coverage and one successful new-car query, with first results around 23–36 seconds in this environment. Next work should validate hosted search with configured credentials, measure in the production region, improve city evidence for added sources, and reduce discovery fan-out using measured source yield. Do not claim market completeness, instant cold search, or readiness to replace production.
