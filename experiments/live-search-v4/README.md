# Dalelah search study: v4

Isolated experiment; production unchanged. This is a prepared benchmark plus a small live scheduling pilot, not a completed 100-query provider study.

## Implemented

- Source selection starts three query-appropriate sources immediately; remaining adapters begin after four seconds. All sources remain eligible. New-car requests prioritize Motory, Syarah and Saleh. Priorities are hypotheses from the small v3 sample, not learned general rankings.
- Brave and Tavily adapters return trusted direct-ad URLs only. Provider prices, snippets and condition claims cannot enter final evidence. Both use an eight-second provider timeout. Tavily uses fast mode with no answer, raw content or images. Brave uses its web-search endpoint; unsupported source domains are filtered after retrieval. Each provider makes one request per query.
- Exact-ad identity, condition, price, city and other existing validation gates remain unchanged. A missing provider key blocks hosted/hybrid runs instead of silently substituting direct search.
- 100 synthetic benchmark queries: 50 Arabic, 50 English, representing 50 paired scenarios. Eight models cover five condition/city/budget combinations; ten broader scenarios cover five origins and two body types. Low-budget cases stress empty results but are not assumed to have no market matches.
- Manually specified intents isolate retrieval. This benchmark does not test natural-language interpretation. Query wording, ground-truth listings and relevance labels still require independent human review. Paired translations are not 100 independent scenarios.

## Live pilot method

Four previously used queries: used Corolla/Jeddah, Japanese SUV/Riyadh, Audi Q8 and new Elantra. Both arms receive identical frozen intents, 30-second retrieval limits, 12 detail attempts, six network slots and empty result caches. Baseline searches all sources immediately; scheduled staggers source discovery. Order alternates by case. Each arm uses a fresh transport and robots cache. This is one repeat per case, subject to source/network variation, and not a randomized production A/B test.

The v3 comparison allowed 60 seconds and 18 attempts, so its totals are not directly comparable. Failures within the deadline are retained; first-result timing must not be summarized only for successful cases without reporting failures.

## Verification and remaining work

26 targeted tests pass, including the inherited 19 evidence/cache/deadline tests and seven benchmark/provider/source-selection/cancellation tests. Provider tests use controlled responses, not live paid APIs. No OpenAI, Tavily or Brave key is configured in this execution environment. No credentials were printed or copied from production.

The full provider study is blocked on secure runtime credentials. No API cost, hosted-search coverage, five-second performance, independently judged precision or recall is claimed. Raw HTML remains transient; no images or inventory archive are downloaded. Reports store compact evidence records for review.

Run:

```sh
node --test experiments/live-search-v4/core.test.mjs experiments/live-search-v4/study.test.mjs
node experiments/live-search-v4/pilot.mjs
# Configure TAVILY_API_KEY or BRAVE_API_KEY securely before hosted runs.
STUDY_MODE=hosted STUDY_PROVIDER=tavily node experiments/live-search-v4/benchmark-run.mjs
STUDY_MODE=hybrid STUDY_PROVIDER=tavily node experiments/live-search-v4/benchmark-run.mjs
STUDY_MODE=baseline node experiments/live-search-v4/benchmark-run.mjs
```

Full benchmark runs are sequential, bounded at 30 seconds per query, and checkpoint after each query. They make up to 100 provider calls per hosted/hybrid run, plus source-page requests. Repeated comparison should rotate arm order and run in the same region/time windows. Provider credits are recorded where returned; currency cost remains uncomputed until the account's actual rates are known.

Next evaluation: independently label a pooled sample of source ads, identify physical-car duplicates conservatively, measure first/five-result latency with no-result rate, precision at five, pooled-reference recall, source diversity and cost per successful search. Rank fusion and physical-vehicle deduplication remain later work, not implemented or validated here.

## Research basis

- [Google: crawling, indexing and serving](https://developers.google.com/search/docs/fundamentals/how-search-works)
- [Brave web-search API](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started)
- [Tavily search API](https://docs.tavily.com/documentation/api-reference/endpoint/search)
- [Reciprocal rank fusion](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion)

## Pilot results

| Query | Baseline ads | Scheduled ads | Baseline first | Scheduled first |
|---|---:|---:|---:|---:|
| corolla-en | 0 | 2 | none | 20.63 s |
| suv-ar | 2 | 2 | 18.64 s | 15.84 s |
| audi-en | 0 | 5 | none | 10.18 s |
| elantra-new | 0 | 0 | none | none |

Observed totals: baseline 2 accepted ads and 3/4 no-result queries; scheduled 9 accepted ads and 1/4 no-result queries. All runs stopped at the 30-second budget. These counts are per-query source ads, not independently audited unique physical vehicles. Scheduling first results ranged from 10.18 to 20.63 seconds among successes. The five-second target was not met. One small run cannot establish stable lift; no recall/precision claims are supported without human labels. Keep the experiment isolated and repeat in the deployment region with provider credentials before a release decision.
