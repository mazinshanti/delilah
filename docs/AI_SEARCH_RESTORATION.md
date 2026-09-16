# AI intent restoration

## Root cause
The active `server-entry.js` boots `server-core-candidate.js`. Its POST search route previously called only `naturalSearch` and catalog normalization. Older OpenAI implementations in `server-v1.1.js`, `server-v1.2.js`, and `server-v34.js` were not the active front search route. Additionally, `market-ui.js` stripped natural-language phrases before POSTing the query. The mere presence of an API key or older AI code did not prove an AI request occurred.

## Architecture
Original query → lightweight classifier → server-side OpenAI Responses structured intent (when needed) → strict schema validation → catalog normalization and explicit make/model/year overrides → existing indexed/direct/deep search → existing sale/price/year/model gates → origin/exclusion/attribute enforcement and evidence-only ranking → unchanged source URLs and galleries.

Simple searches do not invoke a model. The frontend preserves the original query and skips unvalidated cached previews for conversational queries. Polling retains the intent and applies the same constraints to late-arriving results. Neither model output nor AI interpretation can supply listing records.

## Configuration
Reuse `OPENAI_API_KEY` on the **front Render service**. No keys are stored in source or browser code.

| Variable | Default |
|---|---|
| `DALELAH_AI_SEARCH_ENABLED` | enabled unless `false`; missing key falls back |
| `OPENAI_API_KEY` | required for actual AI calls |
| `DALELAH_AI_MODEL` | existing `OPENAI_MODEL`, otherwise `gpt-4.1-mini` |
| `DALELAH_AI_TIMEOUT_MS` | 4500; bounded 100–8000 ms |
| `DALELAH_AI_MAX_RETRIES` | 0; maximum 1, shared timeout budget |
| `DALELAH_AI_CALLS_PER_MINUTE` | 30 per instance; bounded 1–120 |

Provider requests use `store:false`, a strict JSON schema, and a bounded output. No seller contact records, images or inventory are sent to the provider. Only the search query and catalog make names are sent. Provider prompt treats user text as untrusted data.

## Cost, availability and observability
15-minute bounded intent cache; coalesced requests; maximum four concurrent provider calls. All provider errors, invalid output, low confidence and unknown catalog models fall back. Safe exact queries continue through rules. An unsupported description is not silently broadened: the UI asks for make/model/year or explicit filters. `intentMode` is `ai`, `rules` or `literal`; `ai.fallbackReason` makes degraded interpretation explicit.

`GET /api/search/ai-status` exposes non-secret readiness and model configuration, not credentials. Actual `intentMode:ai` from a conversational search is the deployment success criterion. Development-only `/api/search/ai-metrics` and response `intentDebug` expose diagnostic state. Production logs contain hashed query identifiers and aggregate mode/latency/confidence/count/source information, not raw query text, API keys or provider payloads.

## Ranking limitations
Scores reflect only listed price, source-provided body/fuel/trim, exact year and a maintained brand-origin map. Origin means brand provenance, not manufacturing location. Unverified maintenance, reliability, comfort, sportiness and family suitability remain visible preferences, not invented factual ratings. Missing hard body/fuel/origin/transmission evidence excludes a vehicle; this can produce fewer results. Unsupported descriptions during AI outages ask the user to simplify rather than claim an exhaustive market zero.

## Regression coverage
`tests/ai-search-intent.test.mjs`: all 14 requested example queries; strict schema, catalog rejection, exact year, no fabricated listings, origin/exclusions, cache/coalescing, provider failure/timeout, disabled/missing key, selected condition, budget intersection and log privacy.

`tests/ai-search-http.test.mjs`: actual HTTP search and polling routes using isolated test-only provider/inventory fixtures; original galleries preserved; wrong model/year rejected; Pontiac zero; unvalidated preview suppressed; server-only module inaccessible.

Provider fixtures are not production verification. After publishing, verify `/api/search/ai-status`, then POST an Arabic or English conversational query and inspect `intentMode`, intent, real listing URLs and polling. A missing/invalid key is a launch blocker, not a successful AI release.

## Changed files
`lib/ai-search-intent.js`, `public/search-route.js`, `server-core-candidate.js`, `public/market-ui.js`, the two test files above, and this report. No source connector, inventory snapshot, gallery implementation, seller store, deployment topology or database schema changed.

Implementation reference: https://developers.openai.com/api/docs/guides/structured-outputs
