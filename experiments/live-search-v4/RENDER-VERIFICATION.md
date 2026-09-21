# Render preview verification — 2026-09-21

- Service: dalelah-on-demand-preview-0921 (srv-daogoj0473hc73a90d1g).
- URL: https://dalelah-on-demand-preview-0921.onrender.com
- Deployed commit: a5d5ac2e429dbd535084f925c0550195b5e830d3.
- Live deployment: dep-daogovtii2qc73cm61bg.
- Runtime: Node v22.23.2, direct-source mode, free Frankfurt instance, automatic deployment disabled.
- Build: 504 repository tests and 27 experiment tests passed; zero failures.
- Installation correction: NPM_CONFIG_INCLUDE=dev supplies test dependencies under NODE_ENV=production.
- Health: HTTP 200; private metrics without authorization: HTTP 401.
- Authenticated search: Toyota Corolla under 45000 SAR in Jeddah, used, explicit maxPrice=45000 and city=Jeddah. POST returned HTTP 202 and polling completed.
- Six source listings accepted, all from CarSwitch Saudi. First result: 3987 ms; search elapsed: 14584 ms (server-reported, excludes client network latency).
- Completion is partial: coverageComplete=false. Motory, Haraj and Saudi Sale reported source failures; this is not a market-completeness benchmark.
- Metrics: one completed search, zero failed searches, zero hosted-provider calls, 44060 cache bytes.
- No full inventory or image archive; bounded temporary memory still consumes RAM.
- Preview health reports Brave, Tavily and OpenAI credentials absent. Exact-query interpretation used rules. This does not validate hosted search or AI interpretation.
- Existing production services and main branch were not changed.
- Remaining: link existing provider credentials within Render, run hosted-provider and bilingual study, integrate frontend and production monitoring/limits before rollout.
- Connector limitation: existing environment secrets cannot be read or copied using available Render MCP operations. No new credentials were requested.
