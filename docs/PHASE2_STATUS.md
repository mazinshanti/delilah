# Dalelah Phase 2 — Vehicle Data Intelligence

Working branch: `dalelah-phase-2-vehicle-data-intelligence`
Production base/checkpoint: `9ab59627cf9cdeef5c74b7a1b0af8a9b42761257`
Recovery branch: `checkpoint-2026-09-12-haraj-price-live`
Draft PR: #7

## Completed in Phase 2 so far
- Evidence-first Haraj mileage parser with Arabic/Persian digits and grouped-number support.
- Haraj mileage fields: `mileage`, `mileageVerified`, `mileageSource`, `mileageEvidence`.
- Strict Syarah cash-price parser supporting current English/Arabic cash-price labels and description price phrasing.
- Syarah detail-page price enrichment for listings that arrive without a price.
- Syarah price enrichment runs progressively and does not block first results.
- Price safety: installment, old/discount amount, and mileage are not accepted as the cash vehicle price.
- Dedicated Phase 2 QA covers mileage, Haraj price, Syarah cash price, direct search, marketplace, exact-year, and brand relevance.

## Next acceptance gate
Deploy Phase 2 to an isolated sandbox and verify a real Syarah detail URL can be fetched from Render and enriched with the current cash price before any production promotion.
