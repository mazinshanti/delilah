# Observed live source session — 2026-09-19

This is a direct source-page and detail-parser audit, **not** a completed Dalelah OpenAI web discovery benchmark. No local provider API key was available. The separate 12-query AI benchmark is prepared for the configured Render environment. No production writes or deployment occurred.

## Measured counts

| Source | Discovered candidates | Detail checks | Accepted source ads |
|---|---:|---:|---:|
| CarSwitch Saudi | 72 | 24 | 20 |
| Syarah | 12 | 4 | 4 |
| Haraj | 57 | 12 | 3 |
| Saudi Sale | 39 | 4 | 0 |
| Mercedes-Benz Saudi | 24 | 4 | 0 |

Unique accepted source URLs: **27**. This is a bounded sample, not maximum source capacity or complete Saudi market coverage. Different source ads for the same physical vehicle are not deduplicated without reliable shared identity.

CarSwitch: eight model page probes, at most eight detail checks per model. Corolla and Elantra each accepted eight; Patrol accepted four of eight. BMW X5, Ford F-150, Mercedes C-Class, Porsche 911 and MG ZS page probes yielded no extractable supported detail links. Those zeros are extraction/path limitations, not evidence of absent source stock. Total CarSwitch audit elapsed time: 385414 ms.

Syarah: four of four detail checks accepted (Tank 300, RAV4, Accent, Tucson). Saudi Sale: 39 direct candidate URLs from its home page, but four detail checks returned no-exact-vehicle-evidence. Mercedes: 24 list-schema records; three detail requests rejected by the redirect identity guard, one timed out. Discovery-page records are not counted as accepted details.

Haraj: three Arabic source searches, at most four detail checks per query. Existing vehicle classification and evidence checks retained. Diagnostics distinguish discovered cards, attempted details, accepted records and rejection reasons. Collected records establish their own make/model; no identity is assigned merely from the search phrase.

## Other source probes

Saleh, OpenSooq, Carly and ArabWheels returned HTTP 200 after the robots probe. They were not admitted to the AI experiment: validated detail adapters are still needed there. OpenSooq existing parser produced 29 candidates from its discovery page; these are not counted as accepted because they were not independently detail-validated. Carly returned a 21 KB HTML page without extractable direct car links in this probe. Audi Approved and Volkswagen Certified robots requests returned 307; the probe stopped and did not classify either source as empty.

Image URL presence is not image HTTP or high-resolution verification. This session did not perform image quality, mobile/desktop UI, production performance or deployment certification. Local curl/proxy timing cannot be treated as Render latency. Full automated regression suite: 379 passed, 0 failed. New session runner syntax and missing-key failure path checked; actual provider run remains pending.
