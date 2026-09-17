# Arabic semantic routing bug investigation

## Verified root cause
On 2026-09-17, the exact query `ابي جيب عائلي ياباني تحت 150 ألف وصيانته رخيصة` already returned `needsAI=true` in the deployed classifier. Production returned `intentMode=rules` with `ai.fallbackReason=not-configured`, not a classifier rejection. `/api/search/ai-status` reported enabled=true, configured=false, OpenAI, gpt-4.1-mini, timeout=4500 ms. There is no working provider call to report until the front service receives `OPENAI_API_KEY`.

## Related defects fixed
- Replaced broad substring checks and the language-mixing trigger with normalized bilingual semantic tokens/phrases. Arabic diacritics, hamza, tatweel, numeral and Saudi-dialect variants are handled. Arabic/English mixing alone is no longer an AI trigger.
- Generic conversational جيب no longer becomes a Jeep make even in fallback metadata. Explicit جيب رانجلر 2022 remains deterministic Jeep Wrangler.
- AI-derived body type no longer becomes an early strict source-field filter. Missing body/origin evidence is retained with `unverifiedAttributes`, receives no matching signal, and is never represented as confirmed. Known conflicting body/origin values are rejected. Explicit UI category filters remain strict.
- Maintenance/family/comfort/reliability priorities were already not hard filters; they still receive no invented factual score. The prior missing-body-field gate could independently empty exploratory searches, but the observed live zero occurred before successful AI interpretation because credentials were missing.
- Responses now expose `aiRequired`, `aiProviderAttempted` and `parsedIntent` alongside normalized `intent` and the existing fallback reason. Sanitized fallback logs distinguish routing intent from provider execution, including missing credentials.

## Scope and tests
Changed: `public/search-route.js`, `lib/ai-search-intent.js`, `server-core-candidate.js`, one existing AI fallback test, two new focused suites and this report. Preserved the current production inventory refresh, connectors, exact-year implementation, pricing, galleries and frontend design.

`tests/search-route.test.mjs` isolates classifier behavior from inventory/provider calls. It covers the requested Arabic/English examples, Saudi phrasing, mixed languages, both numeral forms and make-name substring collisions. `tests/semantic-preferences.test.mjs` covers generic Jeep, missing preference evidence, preserved hard filters, explicit exclusions and truthful missing-key diagnostics. The existing provider-failure test now uses a genuinely conversational mixed query; simple mixed text correctly no longer calls the provider.

## Production acceptance
The release must not be called a working AI release based on mocked tests. After a real key is configured on the front Render service, the exact Arabic query must return `aiRequired=true`, `intentMode=ai`, no fallback reason, a valid normalized generic SUV/Japanese/family/budget intent and genuine source listings. `Camry 2022` must remain rules/literal. Provider-success logs are required to establish end-to-end success.
