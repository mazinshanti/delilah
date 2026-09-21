# On-demand search experiment — 21 September 2026

This isolated experiment starts from `07d4cfd`. It changes no production code, dependencies, source connectors, inventory files, or deployment configuration.

## What is exercised

- Three requests: used Corolla under SAR 45,000 in Jeddah (English), Japanese family SUV under SAR 150,000 in Riyadh (Arabic), and new Corolla under SAR 100,000 (Arabic).
- Production's search response supplies the existing interpretation and baseline. Its returned cars are **never** passed into the independent live retrieval lane. This bridge also triggers the existing production search, so the experiment does not demonstrate a fully independent inventory-free AI endpoint.
- Two live sources: Haraj and OpenSooq. Broad Japanese intent expands to Toyota, Nissan and Mazda as a bounded sample, not complete Japanese-brand coverage. OpenSooq's current route builder targets used inventory; it is not a sufficient new-car discovery adapter.
- Strict existing brand/model, condition, budget, city, body and origin checks. Original detail evidence is required before acceptance. Unknown information is not filled by AI.
- HTML is processed in memory and discarded. Images are referenced by URL and never downloaded. No inventory snapshot is loaded or changed. JSON reports are diagnostic artifacts, not a production index.

## Boundaries

This is a source-retrieval feasibility test, **not** a completed hosted-web-search integration. No independent model/search-provider credentials were available in the local environment. No new paid service was provisioned. Query translation/ranking beyond the existing intent parser, an external cache, full-source coverage, concurrent-user load and per-search cost have not been measured.

Network timings include this workspace's proxy and should not be treated as production latency. First baseline response can be partial; the later response is also explicitly labelled with completion state. Candidate counts are not verified inventory counts. URL deduplication is not proof that cross-source duplicate vehicles have been eliminated.

The first run (`results.json`) exposed redirect handling and request timeout limitations. The corrected run (`corrected-results.json`) handles bounded same-host redirects, preserves Haraj ad identity, increases the per-request diagnostic timeout, and selects candidates using the hard filters before checking details. These runs are not directly comparable performance measurements because their request budgets differ.

## Run

```sh
node experiments/live-search-20260921/trial.mjs
# Optional single case, separate diagnostic report:
TRIAL_CASE=corolla-en TRIAL_REPORT=corolla-repeat.json node experiments/live-search-20260921/trial.mjs
```

## Validation

45 existing tests passed: `tests/direct-search-core.test.mjs` and `tests/ai-search-intent.test.mjs`. These check filtering/intent behavior; they are not evidence of live source coverage. Script syntax passed.

## Measured result

| Query | Current search initial matches | Live-only detail-checked matches | Live-only elapsed |
|---|---:|---:|---:|
| Used Corolla, Jeddah, <= SAR 45k | 5 | 0 | 35,975 ms |
| Japanese family SUV, Riyadh, <= SAR 150k | 220 | 1 | 33,286 ms |
| New Corolla, <= SAR 100k | 4 | 0 | 13,695 ms |

The first responses above are partial/current-search observations, not verified full-market totals. The two methods do not have equivalent coverage or verification budgets. No conclusion about total market availability follows from this table.

The accepted live result was a Haraj Mazda CX-9 2019, SAR 65,000, Riyadh, used (ad 11189013208). Exact-ad detail evidence supplied the title, price and condition; city came from the source search card; SUV body type was resolved through the existing catalog. Availability was not independently confirmed with the seller.

For the SUV query, production's hosted AI correctly resolved bodyType SUV, origin Japanese, maxPrice 150000 and city Riyadh. The first-run AI call was reported as 3,889 ms; this is interpretation time, not whole-search time.

OpenSooq search pages returned candidates, but this experiment's detail readers did not obtain matching exact-ad structured evidence. Do not represent that as proof that those cars are unavailable. A separate diagnostic request to one OpenSooq URL returned a Forbidden page; access and detail parsing both need dedicated investigation. No access restriction was bypassed.

**Decision: do not replace current search with this prototype.** Feasibility of one live retrieval is established, but coverage, latency and completeness do not pass. Next work should add an independently configured hosted discovery provider, source-specific detail validation and new-car adapters, then repeat the same cases from the deployment region. Keep current search available until that comparison passes. No paid provider or production change was made.
