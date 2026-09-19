# Bounded AI listing experiment

This is an offline experiment, not a production route or deployed feature.
It reuses search intent, current filters, Haraj discovery/exact-page evidence,
vehicle admission and canonicalization. An additional AI reviewer checks the
already admitted source advertisement. Source links and images are never generated
by the model. Unsupported values or disagreement exclude the trial result; model
output cannot bypass quarantine or fill missing fields.

Run with the existing server-side OPENAI_API_KEY available in the environment:

```sh
node scripts/ai-listing-trial.mjs --live 'تويوتا كامري' '{"maxPrice":100000,"maxMileage":100000}'
node scripts/ai-listing-trial.mjs audit.json 'Toyota Camry' '{}'
```

Do not put the API key in command arguments, reports or frontend code.
The runner performs at most one discovery query and 12 detail attempts, respecting
the existing source pacing/robots policy. AI review has a maximum of 12 calls,
two concurrent requests, 4.5-second timeout, no retries, and per-run caching.
The live discovery budget is 60 seconds; already-running source requests may finish
after that budget. This is not a promised user-facing latency. The report measures
discovery time, first accepted result time and individual AI latency.

Limitations: this does not provide comprehensive market coverage, independent
inspection, image availability/dimension validation, or rescue advertisements
rejected by existing admission. Numeric fields remain subject to source parsers.
Current simple-query routing may use deterministic intent rather than AI, as in
production. Semantic queries use the existing intent engine. No public UI changes.

Local validation: mocked-provider tests cover Arabic/English, hard filters,
non-car exclusion, invented quotes, wrong numeric evidence, provider failure,
and source identity preservation. Live AI measurement is blocked in the local
workspace because OPENAI_API_KEY is not configured; mocked tests are not evidence
of real provider speed or accuracy. Production remains unchanged.
