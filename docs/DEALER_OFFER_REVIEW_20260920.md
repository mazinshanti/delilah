# New dealer content review — 2026-09-20

Candidate-only change; not merged to main, deployed, or connected to production inventory. The directory's discovered URLs are not accepted listings. This pass examines real source content instead of inflating discovery counts.

## Findings and changes

- Khaled Cars embeds a 300×200 thumbnail in its Car JSON-LD while the primary gallery exposes larger source images. The isolated review parser uses observed gallery upload URLs only, never synthesized image variants or recommendation images.
- Its visible price is explicitly a starting price. JSON-LD represents it as an ordinary Offer price. The parser requires agreement between visible price and SAR schema, stores `startingPriceSar`, and leaves `priceSar` null. VAT inclusion stays unknown. Schema InStock is preserved as a source assertion, not verified individual stock.
- Actual Arabic Kia title `كيا كي 3 جي ال 2025` failed canonical model identification although English K3 was already known. Added the exact observed `كي 3` alias to the shared model group and generated catalog. No classifier rules changed. The catalog builder already reads MODEL_GROUPS, so future builds retain the alias.
- English Khaled fields use Engine Type and Drive Type. Those explicit labels now map to the same evidence fields as Arabic. Engine units are retained as raw evidence because the page mixes litre and CC labels. Missing mileage, trim, VAT and individual stock remain unknown.
- The primary h1, single Car schema, purchase-link vehicle ID, model year and known make/model must agree. Related vehicles are excluded from specs, prices and images. Extracted offers retain field provenance and direct source URLs.
- Thil Al Jazeera's public page distinguishes 71,000 SAR before tax and 81,650 SAR after tax. Direct workspace fetch returned HTTP 406. No 406 body was ingested; no connector was enabled or protection bypassed. Condition was not established.

## Live source sample

| Source offer | Language | Outcome | Gallery URL count | Decoded first image |
|---|---|---|---:|---|
| Khaled Corolla 401 | Arabic | Dealer-offer review | 13 | 1600×900 |
| Khaled Corolla 401 | English | Dealer-offer review | 13 | 1600×900 |
| Khaled Accent 161 | Arabic | Dealer-offer review | 23 | 1600×1200 |
| Khaled Kia K3 1552 | Arabic | Recovered after catalog alias fix | 14 | 960×438 |
| Thil Al Jazeera Corolla 200 | Arabic | HTTP 406; not parsed | Not measured | Not measured |

Four language/page checks represent **three unique dealer offers**, not four cars or verified individual inventory. Three unique representative gallery images decoded successfully. Remaining gallery images were not fetched. No claim that every image works. Detail-plus-sample-image checks took roughly 16–17 seconds in this workspace, including deliberate source pacing; these are not browser search latency or Render timings.

The first run rejected Kia and lacked two English spec mappings. A second live run after fixes verified English Corolla and Arabic Kia; `qa-20260920/dealer-offer-review.json` contains the latest result per URL. There are zero newly admitted inventory listings.

## Validation

- `npm test`: **427 passed, 0 failed**, no skips.
- Six new regression cases cover starting vs cash price, thumbnail/recommendation exclusion, exact offer binding, non-200 responses, missing evidence, English labels and canonical Arabic K3 without parts/other-brand leakage.
- Script and module syntax checks pass.
- Existing production classification, Haraj connectors and source registry were not modified by this pass.
- Browser mobile/desktop QA and production deployment verification were not performed for this candidate-only change.

## Reproduce

Create a JSON array of 1–6 observed `https://khaledcars.com/ar/car/<slug>/<id>` or English detail URLs, then run:

```sh
node scripts/khaled-source-review.mjs urls.json report.json
```

For this proxy workspace use `DALELAH_REVIEW_CURL=1`. No AI credential is needed. The runner checks robots, spaces requests, refuses redirects and non-200 bodies, bounds responses, caches repeated image samples for the session, and checkpoints after each page. It does not write inventory. Only run against the reviewed exact host/routes.

## Remaining work

Production ingestion must preserve starting-price semantics and distinguish dealer offers from specific stock before this source can be activated. Source evidence and terms review remain separate from URL discovery; the public terms describe personal use and nonbinding prices, so this test does not claim reuse authorization. Additional sources require their own content/availability validation. Speed work, complete-market coverage, UI integration, production deployment, and comprehensive source QA are not completed by this isolated pass.

First-party pages inspected:
- https://khaledcars.com/ar/car/toyota_corolla_xli_20_standard_with_hubcaps/401
- https://khaledcars.com/en/car/toyota_corolla_xli_20_standard_with_hubcaps/401
- https://khaledcars.com/ar/car/hyundai-accent-fleet-15/161
- https://khaledcars.com/ar/car/kia-k3-gl/1552
- https://khaledcars.com/ar/terms
- https://tj4cars.com/cars/200/تويوتا-كورولا-XLI-2025
