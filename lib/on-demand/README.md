# On-demand search: private preview integration

Status: implemented on the experiment branch, disabled by default, not deployed. This is a private preview service, not a completed public rollout. Existing `/api/search`, inventory loading and UI behavior remain unchanged. The front server imports these routes only when `DALELAH_ON_DEMAND_ENABLED=true`.

## Configuration

Configure secrets through the hosting platform's secure environment UI, never in Git or a chat message.

- `DALELAH_ON_DEMAND_ENABLED=true` enables preview routes. Unset/false disables them on restart.
- `DALELAH_ON_DEMAND_TOKEN`: a cryptographically random secret of at least 32 characters, required for every preview endpoint.
- `DALELAH_ON_DEMAND_PROVIDER=tavily` or `brave`; requires `TAVILY_API_KEY` or `BRAVE_SEARCH_API_KEY` (also accepts `BRAVE_API_KEY`) respectively.
- `direct` is an explicit diagnostic mode without hosted discovery. It is not silently selected when a key is missing.
- Existing intent-engine configuration applies, including its OpenAI key and request limits. No production secrets were accessed or copied during implementation.

Enabling with missing secrets fails startup. Inspect configuration on a separate preview service before enabling elsewhere. This transport requires the `curl` executable; the deployed runtime must be checked for it.

## API contract

All endpoints require `Authorization: Bearer <preview token>` and return `Cache-Control: no-store`.

- `POST /api/search/on-demand`: JSON `{query, condition, filters}`. Returns 202 with `searchId`, `listings`, `complete`, `status`; the initial response is normally interpreting with no results. It is an acknowledgement, not time to first verified car.
- `GET /api/search/on-demand/:id`: poll for progressive verified listings; `complete` means the bounded request ended, never complete market coverage.
- `DELETE /api/search/on-demand/:id`: cancels ongoing retrieval. Intent interpretation already in progress retains the existing engine's own bounded timeout; cancellation prevents subsequent source retrieval.
- `GET /api/search/on-demand/metrics`: authenticated aggregate counts, per-source accepted/failure counts, active jobs, cache bytes and provider call/error totals. Raw queries, bearer tokens and provider errors are not exposed.

Supported explicit filters: min/max year, min/max price, city and fuel type. Other UI filters fail explicitly rather than being silently ignored. Public UI integration is pending; the preview token must never be embedded in a shipped browser bundle. Existing UI search remains the fallback by using its unchanged endpoint.

## Operating bounds

Single-process preview only: two concurrent jobs, 32 retained jobs, 100 starts/hour and 20 hosted-search requests/hour. Limits reset on process restart; they are not an account-wide billing guarantee. Shared durable counters or provider-enforced spending limits are required before multi-instance/public rollout. Jobs expire 120 seconds after completion when accessed/pruned. Successful retrieval cache: 2 MB, 16 entries, 60-second TTL. Each job publishes at most 24 listings and rejects result payloads above 128 KB. Active transient HTTP buffers are additional memory.

Network transport is shared across jobs: six requests globally, two per host, response-size limits and at most 1,000 in-memory request diagnostics. Request coalescing is scoped to the same abort signal so one job cannot cancel another job's shared fetch. Added-source access restrictions pause that source for 60 seconds. Provider errors fall back to the continuing direct-source search within the same deadline. At most 12 detail checks, 30 seconds retrieval, eight seconds per hosted-search call. Intent time is additional; first-result telemetry includes interpretation.

No page archive, downloaded image files or persistent inventory are created by this new search path. The existing production inventory system remains unchanged and still runs in the front process. Turning on this preview does not remove that existing storage.

Metrics are implemented, but automated alerts and external dashboards are not wired. A platform alert configuration and actual per-search cost measurement remain release gates.

## Verification (21 September 2026)

- Repository regression suite: 503 tests passed before the final additional HTTP smoke test.
- New service suite: 8 tests passed, including real local HTTP routing with controlled listing responses.
- v4 experiment suites: 26 passed in the targeted validation run.
- No live hosted provider test or full 100-query benchmark was performed: credentials remain absent locally.
- Tests ran on Node 24.19.0; the repository targets Node 22. Repeat in the deployment runtime before release.

The source scheduler's prior live pilot returned nine ads versus two in the baseline across four queries at equal budgets. This is not a claim that the preview integration is faster; see `experiments/live-search-v4/README.md` for limits and individual results.

## Release and rollback

1. Confirm the Render workspace and inspect the actual front service, runtime and deployment branch.
2. Create/configure a separate preview runtime with the search credential and preview token, account spending cap and Node 22/curl availability.
3. Run the prepared 100-query hosted and hybrid benchmark with equal budgets, manual reference labels, repeat runs and deployment-region timing. Test source outages and concurrent requests.
4. Finish public UI integration, supported-filter parity, per-user/distributed controls and alerts only after evidence supports rollout.
5. Start a limited rollout with the existing search endpoint available as fallback. Do not remove inventory or production sources as part of this preview.

Rollback for the preview: set `DALELAH_ON_DEMAND_ENABLED=false` and restart/redeploy, or revert the integration commit. Unchanged standard endpoints continue to serve the existing application. This mechanism is documented and default-off installation is tested; no live Render rollback was executed.
