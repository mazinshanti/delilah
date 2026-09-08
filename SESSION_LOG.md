# Delilah Engineering Session Log

## 2026-09-08 — Saudi seller/source plugin expansion

- Continued from the overnight brief with the existing production architecture. No scraper rewrite.
- Added `server-v15.js`, a seller-plugin edge that preserves the v14 stack and adds adapters for YallaMotor, Saudi Sale, and Mstaml.
- Deployed v15 successfully to Render. Regression/syntax checks pass.
- Production observation: v15 starts correctly, but the first catalog refresh indexed zero plugin cars. This is not considered a successful source integration yet.
- Added a public-source probe to QA rather than guessing HTML structures.
- Probe results:
  - YallaMotor catalog request returns HTTP 403 from CI/servers. Decision: do not bypass; convert this source to public search-index discovery + strict direct-ad URL validation.
  - Hatla2ee catalog request returns HTTP 403. Decision: same as YallaMotor; no anti-bot circumvention.
  - Saudi Sale catalog returns HTTP 200 and exposes direct `/en/listings/{id}/{slug}` vehicle URLs. Parser needs to stop requiring condition text at catalog-card stage and verify condition on the exact listing page instead.
  - ArabWheels catalog returns HTTP 200. Direct used-car pages are publicly indexed and contain individual vehicle details, price, mileage, seller and images; use strict direct-ad validation and exact-page enrichment.
  - Mstaml remains search-index mode with `type=4.41` required to distinguish cars/vehicles from other product categories.
- Next implementation target: v16 source-discovery layer for Saudi Sale, YallaMotor, ArabWheels and Hatla2ee, with exact-page enrichment when public HTTP access is available and no image/price guess when it is not.
- Product boundary retained: real individual sale pages only; no category/model/search pages; New/Used separation; no anti-bot bypass; no fabricated listing fields.
