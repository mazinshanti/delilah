# Next-stage preview verification — 2026-09-21

Deployed code: 447c6eb60ad26ceb664d5003ca9e15cea8dba4f5.
Live Render deployment: dep-daoh4o3m8hqs73elolog.
Service: srv-daogoj0473hc73a90d1g, https://dalelah-on-demand-preview-0921.onrender.com.
Production main and services unchanged.

## Verified
- Render build: 509 repository tests plus 27 experiment tests, all passed on Node 22.
- Health endpoint served the deployed code SHA.
- Private login exchanged preview-only access code for session cookie and served existing interface.
- Existing interface POST /api/search and GET /api/search/progress/:id work through that session.
- Arabic Toyota Corolla used under 45000 SAR in Jeddah, with the full UI filter shape and Sedan selected: 6 listings, all CarSwitch Saudi; price/city/condition checks passed.
- Server first result 4419 ms; completed elapsed 13350 ms. This is one live query, not a latency benchmark or browser-perceived timing.
- Search remains partial; no market-completeness claim.
- Offline synthetic bilingual intent study: 80 exact matches, 20 require configured AI, zero unblocked mismatches. No hosted-provider calls or live retrieval in that study.
- Local HTTP tests cover login, route mapping, missing authorization, UI filter parity, frozen completion time and fail-closed missing AI.

## Limits
- Provider configuration remains absent on this preview: OpenAI, Brave and Tavily.
- The available connector cannot read/copy existing service secrets. Existing credentials must be linked within Render before hosted/hybrid evaluation.
- Source feedback is bounded in-memory aggregate scheduling, not a trained model; no speed improvement claim yet.
- Browser visual/mobile QA, full live 100-query benchmark, reference labeling, public rollout controls and monitoring remain gates.
- The preview-only access code was renewed for verification; no provider secret was changed.
