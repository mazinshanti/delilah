# Dalelah release diagnostic — 2026-09-09

## Verified live
- www.dalelah.co homepage and /api/health return HTTP 200.
- Production health reports productVersion 1.5 and commit 8886d176019a1cad2cc7c53e08d2632ca849ffdb.
- Candidate homepage and health return HTTP 200.
- Exact used searches verified from Render network: Corolla 2013 and Patrol 2020 return listings with zero wrong-year results.
- New Toyota Corolla 2026 returns live listings.
- /sell and /api/sell/estimate return HTTP 200. Valuation intentionally refuses to invent a price when fewer than three reliable comparables exist.
- Same-origin /mobile route returns HTTP 200 and calls /api/search on the same origin.
- Mobile browser CORS for the Expo preview origin is enabled.
- Expo static preview root and JS asset return HTTP 200; bundle contains the candidate API endpoint.
- React Native source successfully exports for iOS, Android, and web.

## Issues found
1. Production GitHub Actions run 311 failed only at a stale source-text architecture guard for the OpenSooq JSON-LD regex. Syntax, five exact-year tests, and five UI tests passed. Fix the QA guard; do not change the parser.
2. The old Expo-on-Render browser preview is an unnecessary failure surface. Prefer the same-origin /mobile experience for public preview and keep Expo for native builds.
3. Production has multiple legacy/wrapper services and extra preview services. They create operational confusion. One production service + one release candidate should be the authoritative web/API path.
4. The website source dropdown is stale: it exposes YallaMotor despite the production network being blocked there and omits OpenSooq despite OpenSooq being live.
5. Full progressive scans can take tens of seconds. UI must render first useful listings immediately and continue scanning in the background rather than waiting for complete=true.
6. Seller PII remains disabled until Saudi-hosted storage is connected.

## Release gate
A release is functional only when: syntax + exact-year + UI + marketplace tests pass; iOS/Android/web Expo export passes; live homepage/health/search/New/Sell/mobile smoke suite passes; production reports the exact promoted Git SHA; and seller PII remains locked without Saudi storage.
