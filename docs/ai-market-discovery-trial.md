# Adaptive multi-source discovery experiment

This is an isolated CLI experiment, not a production route or deployed search feature.

`node scripts/ai-market-discovery-trial.mjs 'كورولا' '{}'`

Requires the existing OPENAI_API_KEY in the runtime. Defaults to GPT-5 mini, three sequential adaptive rounds, two tool calls per round, and at most 24 detail checks per run. Results are emitted as each listing is validated. These are per-run budgets, not inventory coverage targets.

Domains and direct-listing routes come from connected SOURCE_REGISTRY entries. Currently: Haraj, Syarah, CarSwitch Saudi, Saudi Sale, Mercedes-Benz Saudi. OpenSooq and Saleh remain connected to the existing platform but are not yet enabled in this experimental detail reader because the registry lacks validated direct-listing route definitions for this path. Blocked, permission-required, catalog-only and unconnected sources are excluded.

The model receives the original query, hard filters, prior checked URLs, rejection counts and acceptance counts. It is instructed to adapt wording and sources. Only completed web-search tool sources yield candidates; model answer text never supplies inventory. Real provider efficacy remains unmeasured until the CLI runs with a live key. Mocked provider tests establish orchestration, not market coverage.

Detail reads cache robots per run, pace requests, cap bytes and time, follow at most three validated same-origin redirects, and pause a source on 401/403/429. Detail redirects must preserve source listing identity; discovery-page redirects must remain on an allowlisted inventory route. Robots and pacing apply at every hop. Cross-host, unrelated-ad and unrecognized-route redirects are rejected. No challenge bypass. Existing parsers and exact-ad matching exclude recommendation records. Existing identity, quarantine, condition, price, mileage and intent constraints remain in the acceptance path.

Limitations: no persisted cross-run cache, no exhaustive-market guarantee, registry route/language variants may miss valid links, source detail pages may not expose the listing schema supported by existing inventory parsers. This experiment does not assert that every allowed source has produced verified live results. Provider errors and sparse results are reported rather than counted as successful coverage. Production rollout requires live multi-source validation and browser/regression deployment gates.

## Inventory-page expansion

Grounded search sources/citations can now nominate allowlisted inventory pages (CarSwitch city/model inventory, Saudi Sale car-class inventory, Syarah /en/autos). Editorial /newsroom, /carsguide and /prices routes remain excluded. At most four unique inventory pages are fetched per run with the same robots, delay, size and access checks. Only same-source direct listing anchors become candidates; each candidate is independently fetched and checked using the original query and filters. No inventory page is counted as a vehicle. This is a bounded first-page expansion, not exhaustive pagination. AI instructions explicitly target transactional route patterns and exclude editorial paths.

## Budget sharing after live CarSwitch result

User-provided Render output recorded 24 checks, 22 accepted CarSwitch Corolla advertisements, 2 HTTP 404 responses, and 82,560ms total time in one round. This establishes one-source trial success, not complete market coverage or production deployment.

The next revision spreads the unchanged total detail budget over the configured rounds. Candidates remain queued during the run; each batch rotates among available source queues, starting with sources checked least often. AI feedback includes per-source discovery/check/acceptance/pending counts and sources with zero checks. This does not force source diversity in result ranking: final accepted records use the existing relevance ranker. Pending URLs are returned but not persisted or automatically resumed across runs. First-result timing is measured; no latency improvement is asserted without live measurement. CLI output is compact by default; DALELAH_AI_VERBOSE=1 includes complete listing objects.


## Locale identity regression

The user-provided next run had 29 discovered URLs, 24 checks, 2 accepted (Syarah and CarSwitch), firstResultMs 19123 and totalMs 87050. Twenty CarSwitch /en/ pages failed exact-URL equality while the same ads without /en/ had succeeded previously. Matching and within-run deduplication now use the source listing ID for CarSwitch and Syarah. Related ads with different IDs remain excluded. The Syarah registry accepts its observed /cardetail/ Arabic route as well as /en/cardetail/. These changes do not infer condition, price or other missing evidence.
