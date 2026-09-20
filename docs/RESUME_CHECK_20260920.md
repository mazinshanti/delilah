# Dalelah resumed validation — 2026-09-20

## Production baseline

The live `/healthz` returned `ok: true`, `inventoryLoaded: true`, and
`renderGitCommit: db48a90b1f2312b9b1e8838fff34889e5860fe5d`.
This main commit refreshes `data/market-inventory.json.gz`; the experiment
remains isolated on `haraj-coverage-expansion-20260919`.
Do not overwrite that production inventory with the separate local snapshot.

## Changes and evidence

- Mercedes detail URLs returned HTTP 301 to the identical path with a trailing
  slash. The trial treated this as a different advertisement and blocked it.
  Identity now ignores only the terminal slash for this source. Cross-host,
  other-ad and other-path redirects remain rejected.
- The actual EQA page returned HTTP 200, 250105 bytes. Its JSON-LD Offer and Car
  omit URLs; the generic reader therefore could not associate them with the
  fetched advertisement. A source-scoped trial fallback now requires one Offer,
  one breadcrumb list, a matching final breadcrumb URL and vehicle name, SAR
  currency, and no conflicting Offer/Car URL. It reuses the existing inventory
  normalizer and classification. It does not borrow related vehicles.
- The live page for stock 21715788 produced Mercedes EQA, 2024, used, SAR 130000,
  11000 km. It passed `strictDirectListings` and `applyIntentConstraints` for
  `Mercedes EQA`. An image URL was present; HTTP/image resolution was not tested.
- Saudi Sale used Audi `sa591B` returned HTTP 202 with an empty body. No evidence
  could be extracted. This observation does not establish that its parser or
  inventory is absent, and no empty response is counted as an accepted car.

## Verification

`npm test`: 390 passed, 0 failed.
Added regression tests for exact dealer redirect identity, matching breadcrumb
binding, ambiguous multiple Offers, other-ad metadata, wrong currency, and
missing evidence.

## Next gate

Update the temporary Render trial with the pinned candidate files, including
`lib/saudisale-detail-trial.js`, then rerun the 12-query session. Compare first
result time, total time, unique accepted advertisements, and per-source reasons
against the user-observed 25 accepted / 108 checked / 463654 ms baseline.
No new AI-provider benchmark was executed here (no local provider credential).
The previous speed sample is a separate direct-source experiment, not a measured
improvement to the live user search. No merge, deployment or frontend change was
performed as part of this resumed validation.
