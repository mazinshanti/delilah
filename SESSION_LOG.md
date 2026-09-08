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
- v16 added strict seller plugins for Saudi Sale, YallaMotor, ArabWheels and Hatla2ee while preserving the existing source stack. Public search-index discovery is used where direct catalog access returns 403; no anti-bot bypass is attempted.
- Researched the next official-dealer wave using current public dealer sites. Confirmed candidates include Audi SAMACO stock, Geely Wallan buy-online, Hyundai Wallan / Almajdouie / Naghi, Honda Abdullah Hashim, Changan Almajdouie, Peugeot Almajdouie, Jetour KSA, Haval ADMC and GAC Aljomaih.
- Added `server-v17.js` with a new **Genesis Wallan Certified** adapter. Genesis Wallan exposes a public certified-pre-owned inventory with direct vehicle URLs such as `/en/inventory/2026-g80-tu301492`, real total purchase price and mileage data. The site explicitly states that some gallery pictures are not the actual vehicle, so Delilah intentionally suppresses those images rather than showing a misleading photo.
- Added `/api/source-plugins` to expose the seller-adapter registry and integration status. The registry now tracks 30+ Saudi seller/source plugins across marketplaces, certified-used programs and official distributors, separating active integrations from candidates still being validated.
- Added production QA `tests/genesis-wallan-v17.mjs` to require direct Genesis inventory URLs, certified-used separation, numeric verified prices when present, and **no non-actual Genesis gallery image exposure**.
- Product boundary retained: real individual sale pages only; no category/model/search pages; New/Used separation; no anti-bot bypass; no fabricated listing fields.
- Next targets in order: validate Genesis v17 live deployment; then Audi SAMACO stock; Geely Wallan transactional stock; Honda Abdullah Hashim; Hyundai three-distributor coverage; Changan / Peugeot Almajdouie; Jetour; Haval; GAC. Only activate a seller when Delilah can point to a real individual car page or a verifiably transactional stock unit.

## 2026-09-08 — Full product v24

- Activated the previously staged v23 edge so exact Syarah cash-price verification and the ArabWheels direct-new-stock fallback are part of the production chain.
- Added `server-v24.js` as the customer-product edge. It preserves the verified inventory/search architecture while applying strict user-facing filters, canonical URL de-duplication, product completeness scoring and sorting.
- Hard-filter behavior is now explicit: when the user sets a maximum price, Delilah only returns listings with a verified numeric price inside that budget; year, mileage and city filters similarly exclude listings whose required value is unknown. This prevents uncertain data from silently violating a search constraint.
- Added `public/product-v24.html`, replacing the engineering-style search shell with a responsive product experience: New/Used tabs, Arabic/English natural-language search, filters, progressive scan feedback, verified listing cards, source counts, sorting, Saved Cars, three-car Compare, source directory and mobile layouts.
- Saved Cars and Compare currently use browser-local state; no user account is required.
- Listing cards continue to open the original seller page. Delilah does not claim ownership of third-party inventory and does not fabricate missing prices or images.
- Added the v24 source-drawer hotfix for graceful source-registry failures.
- Added frontend product-shell QA that parses the actual inline JavaScript, verifies the core UI surfaces, and catches syntax failures before deploy.
- Haraj full/progressive results now re-check individual Haraj ad pages rather than trusting discovery metadata alone. Exact-page enrichment can replace title, year, mileage, city, price and image; verified Haraj prices use `haraj_exact_listing_price`, verified images use `haraj_exact_listing_page`, and exact pages identified as sold are removed.
- Added `tests/haraj-exact-v24.mjs` and made exact Haraj verification part of the production gate. The live production test passed, proving the current service can return direct individual Haraj ads and verify at least one result from its exact page.
- Updated product UI and live-smoke QA to expect the v24 production edge and updated the GitHub Actions deploy-ready gate to require `product-v24`, `fullProduct`, `strictVerifiedFilters`, the v24 frontend marker and Haraj exact-page support.
- Render production startup and deployment verified successfully: `server-v24.js` launches the existing inventory chain through v23 and exposes `Delilah product-v24` on the primary Render URL.
