# Adaptive multi-source discovery experiment

This is an isolated CLI experiment, not a production route or deployed search feature.

`node scripts/ai-market-discovery-trial.mjs 'كورولا' '{}'`

Requires the existing OPENAI_API_KEY in the runtime. Defaults to GPT-5 mini, three sequential adaptive rounds, two tool calls per round, and at most 24 detail checks per run. Results are emitted as each listing is validated. These are per-run budgets, not inventory coverage targets.

Domains and direct-listing routes come from connected SOURCE_REGISTRY entries. Currently: Haraj, Syarah, CarSwitch Saudi, Saudi Sale, Mercedes-Benz Saudi. OpenSooq and Saleh remain connected to the existing platform but are not yet enabled in this experimental detail reader because the registry lacks validated direct-listing route definitions for this path. Blocked, permission-required, catalog-only and unconnected sources are excluded.

The model receives the original query, hard filters, prior checked URLs, rejection counts and acceptance counts. It is instructed to adapt wording and sources. Only completed web-search tool sources yield candidates; model answer text never supplies inventory. Real provider efficacy remains unmeasured until the CLI runs with a live key. Mocked provider tests establish orchestration, not market coverage.

Detail reads cache robots per run, pace requests, cap bytes and time, do not follow redirects, and pause a source on 401/403/429. Redirected advertisements may be missed; this is reported as an HTTP status. No challenge bypass. Existing parsers and exact-ad matching exclude recommendation records. Existing identity, quarantine, condition, price, mileage and intent constraints remain in the acceptance path.

Limitations: no persisted cross-run cache, no exhaustive-market guarantee, registry route/language variants may miss valid links, source detail pages may not expose the listing schema supported by existing inventory parsers. This experiment does not assert that every allowed source has produced verified live results. Provider errors and sparse results are reported rather than counted as successful coverage. Production rollout requires live multi-source validation and browser/regression deployment gates.
