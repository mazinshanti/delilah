# Resumable source coverage sample

This candidate-only change preserves the production architecture and all existing evidence/intent gates. It does not activate new sources or deploy the trial.

## Problem and implementation

Discovery returned pending detail URLs and pagination URLs, but a fresh benchmark run restarted discovery instead of consuming the remaining work. Checking the same accepted/rejected ads repeatedly spends time without broadening the sample.

The adaptive trial now optionally accepts previously checked detail URLs and previously read discovery pages. Detail history uses the existing canonical source identity, including Arabic/English equivalents. History does not consume the new batch's page budget or inject accepted records. Defaults preserve previous behavior.

The new exact-model sample runner saves results and both remaining queues to a report, then resumes from that report. It checks the saved query before continuing. Transient fetch failures are eligible for a later retry; source restrictions still apply. When enough ads are already queued, it verifies those ads before fetching more discovery pages. Deferred pages are retained for later expansion. This is not an AI replacement; it uses the existing source readers and validation after discovery, with zero provider calls for this sample.

## Scope and measurement

This is a bounded Corolla test against seeded Haraj, Syarah and CarSwitch pages. Saudi Sale and Mercedes were not exercised by these seeds. It is not a measurement of all Saudi marketplaces or total Corolla supply.

Metrics separate known candidates, checked ads, accepted ads, pending ads and rejection reasons by source. `checkedShareOfKnownCandidates` is progress through this discovered queue, **not market coverage**. `marketCoveragePercent` remains null and `coverageComplete` remains false. Image URLs are retained, but image HTTP success is not measured here.

The first three six-ad batches found 104 unique candidate ads, checked 18, accepted 16 and retained 86 pending ads plus one pagination URL. All 18 checks were distinct source identities. A subsequent 24-ad batch increased the totals to **42 distinct checks and 36 accepted matching ads after identity recheck**, with 62 pending ads and one pending page. No claim of exhaustive source coverage.

### Regression found by the larger live sample

One Corolla Cross ad initially passed the Corolla query because Corolla Cross was missing from the canonical catalog. The initial session count of 37 therefore included one model mismatch. Added Corolla Cross with its Arabic alias as a separate catalog model and retained it in the catalog generator. No listing-specific exclusion was added. Fresh extraction of the same live Haraj ad then identified Corolla Cross correctly: Corolla acceptance 0, Corolla Cross acceptance 1. The report preserves the prior status and recheck evidence, with the corrected final count 36. Previously materialized records/caches require refresh before production activation; this candidate has not been deployed. The report's batch counters retain original measurements and should not be mistaken for the corrected final count.

| Batch | New checks | Accepted | First result | Total |
|---|---:|---:|---:|---:|
| Initial page discovery | 6 | 5 | 32.898 s | 47.601 s |
| Resume, also expanding pages | 6 | 6 | 19.261 s | 63.370 s |
| Resume, existing queue first | 6 | 5 | 18.183 s | 33.775 s |

These are workspace source-fetch timings, not Render or browser latency. Work performed differs between batches, so this is not a controlled speedup percentage. Latency still needs production-path improvement. No claim that speed is solved.

## Validation and operation

`npm test`: 433 passed, zero failed or skipped. Added regression cases cover resuming unseen ads, locale deduplication, independent page budgets, hard budget filters, unsafe external URLs, retaining deferred pages with zero page budget, and Arabic/English Corolla vs Corolla Cross identity and retrieval. Syntax checks pass. No desktop/mobile or deployment QA is claimed for this isolated change.

```sh
node scripts/market-coverage-sample.mjs 'Toyota Corolla' sample.json
node scripts/market-coverage-sample.mjs 'Toyota Corolla' sample.json --resume --details=24
```

Use `--curl` only when needed for the workspace proxy. Batches allow 1–60 detail checks; the default six is a test budget, not a product inventory cap. No API key is needed. Reports are atomically replaced after completed batches; interruption during a batch can require repeating that unfinished batch. Keep the report on persistent storage if it must survive a Render restart; `/tmp` is not durable. Accepted records in the report are historical observations, not a refreshed live inventory database.

Deployment, live integration and a true market-size denominator remain outstanding.
