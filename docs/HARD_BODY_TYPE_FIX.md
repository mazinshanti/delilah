# Hard vehicle-body constraints

The previous semantic filtering retained missing body metadata. This allowed sedans into SUV requests. Body type is now a hard constraint, while maintenance, comfort, family suitability and reliability remain soft preferences with no fabricated ratings.

`lib/vehicle-body-type.js` resolves recognized source body type, existing catalog body metadata, curated metadata keyed by the catalog's canonical model identities, normalized model spellings, specific variants and positive title evidence. Unknown remains null. No LLM calls are made per vehicle and no inventory records are created.

The mapping covers 149 existing catalog identities. Source spelling aliases reuse the existing catalog. SUVs/crossovers share SUV; sedans, coupes, hatchbacks, pickups, vans, wagons and convertibles remain separate. 4x4/AWD/4WD alone cannot establish body type. A Land Cruiser pickup is classified as pickup; Corolla Cross and Corolla hatchback do not inherit the base Corolla sedan mapping. Unmapped models require positive source/title evidence or are excluded from a hard category search.

`applyIntentConstraints` enforces resolved equality on every progressive response and adds `resolvedBodyType` plus its evidence provenance. Explicit category filters use the same resolver in `strictDirectListings`. Queries without category constraints preserve their previous matching behavior. No connector, price/year implementation, gallery, source URL, inventory snapshot or frontend design was changed.

Tests: 232 passed, including 25 new resolver/category checks and the updated regression that previously allowed unknown body types. The real indexed inventory test retained 263 Japanese-brand SUVs/crossovers under SAR 150,000 using the existing used/verified-price filters. This offline count is not a claim about the live provider response.

Mapping references include the requested model examples and official Saudi manufacturer ranges:
- https://www.toyota.com.sa/en/vehicles
- https://en.nissan-saudiarabia.com/vehicles/new.html

Files: `lib/vehicle-body-type.js`, `lib/ai-search-intent.js`, `lib/direct-search.js`, `tests/vehicle-body-type.test.mjs`, `tests/semantic-preferences.test.mjs`, this report.
