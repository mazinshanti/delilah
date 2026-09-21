# Connection reuse experiment — 2026-09-21

The preview transport previously launched a fresh curl process for every request. A measured Kayishha request spent 10.3 seconds establishing TLS, versus less than one second receiving the response. This measurement was taken in the development environment with its configured network proxy; it is not a measurement of Render latency.

The transport now uses a shared Undici dispatcher, respecting environment proxy settings and TLS verification. Connections are reused. Global concurrency remains six and per-host concurrency two. Requests retain a 20-second cap within the existing 30-second search deadline. Redirects remain manual, host/ad identity and robots permissions are checked before following, HTTP denials are not retried, and decoded response bodies are capped at 4 MB. Idle connections are retained for up to 60 seconds, subject to source keep-alive limits; shutdown destroys the pool. No disk cache, page archive, image archive, paid provider, or longer search timeout was added.

## Live evidence

Both probes bypass result caching and verify detail pages again. A warm run reuses connections and the existing robots policy cache, not listing results.

| Isolated source | Previous first result | New cold first result | New warm first result | Accepted ads per new run |
|---|---:|---:|---:|---:|
| Kayishha | 47.3 s | 13.7 s | 3.2 s | 1 |
| OpenSooq | 49.6 s | 15.2 s | 4.0 s | 3 |

Previous probes used a 75-second allowance. New probes use the deployed 30-second allowance. These are individual observations, not a controlled benchmark or latency percentile guarantee. Kayishha's accepted ad has an unknown price and is excluded from budget-filtered searches.

`combined-probe.mjs` exercises the actual source scheduler for used Toyota Corolla at or below SAR 50,000, with 12 detail checks and a 30-second deadline. `combined-results.json` records timings, accepted ads, failures and per-request metrics. Sources that do not finish or yield an eligible verified ad are not counted as successful integrations.

Validation: 524 repository tests and 27 experiment tests passed locally. Five new transport tests cover connection dispatcher reuse, redirects/robots, decoded byte limits, non-retry of blocks, deadlines and concurrency. Render's build runs the same suites under Node 22. Production main is not changed.

Undici proxy behavior reference: https://github.com/nodejs/undici/blob/main/docs/docs/api/EnvHttpProxyAgent.md

## Scheduler follow-up

The first combined probe returned 12 ads from three sources (first result 12.4 s), but its repeated run regressed to 25.4 s. The default four-second idle connection timeout was too short for the multi-source search. After setting the idle pool window to 60 seconds, a fresh combined probe returned 9 accepted ads with the first at 13.1 s; the repeated search returned 11 ads with the first at 0.249 s. Both final runs yielded Syarah and CarSwitch results. The final warm search completed in 10.7 seconds. See combined-keepalive-results.json. Variation in network timing and finite detail budgets still affects source diversity; this is not proof of all 12 adapters delivering results. All prices in these budget-filtered runs were at or below SAR 50,000.
