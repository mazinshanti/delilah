# Dalelah Production Checkpoint — 2026-09-12

## Frozen production runtime
- Production runtime commit: `25ae3a93e1429dd3e41b92657577f9dc8a6dd1e9`
- Public service: `delilah` (`srv-daffiulbedkc73920310`)
- Public API/domain: `https://www.dalelah.co` / `https://delilah-pm5f.onrender.com`
- Deep-search backend: `delilah-live-search` (`srv-daff93ou01pc73a7nqe0`), used as legacy-deep fallback.
- Runtime architecture: direct-first front core, remote legacy deep scan.

## Search quality already live
- Strict brand relevance boundary: Bentley search cannot leak BMW/GMC/Toyota results.
- Exact-year protection remains active.
- Used/New separation remains active.
- Direct-first search returns verified first results, then progressive deep results.

## Haraj
- Live Haraj price import is active.
- Evidence-first parsing supports seller text such as `السعر 26000`, commas, dots, Arabic digits and `ألف`, plus formatted card prices.
- Mileage/phone/year values are rejected as prices.
- Junk/parts listings are filtered.

## Syarah
- Missing cash prices are enriched from Syarah detail pages.
- Parser accepts real Cash Price / cash-price evidence and rejects installment/discount/mileage values.

## Saleh Cars
### Live inventory
- Hardcoded Saleh product URLs were removed from the fast path.
- Saleh fast inventory now comes from the live Saleh sitemap.
- Last live diagnostic indexed 391 current English Saleh product pages.
- Results are verified against the current Saleh product page.

### Images
- Saleh vehicle images are extracted from Saleh media assets.
- UI assets such as language flags, logos, app-store/social icons, SVGs and placeholders are rejected.
- Verified images are preserved during merges.

### Prices
- New shared parser: `lib/saleh-price.js`.
- Visible Saleh price is used when present.
- Escaped Next.js `gtmProps.value` is treated as Saleh's primary listing price.
- `gtmProps.price` is retained separately as VAT-inclusive price (`salehVatPrice`).
- Unlabelled installment-style numbers are rejected.

### Production-verified Yaris examples
- Yaris Y 2026: primary `58,900`, VAT `67,735`, verified.
- Yaris Y-Plus 2026: primary `60,900`, VAT `70,035`, verified.
- Yaris Y Limited 2026: primary `57,900`, VAT `66,585`, verified.
- All three return real Saleh product URLs and real Saleh vehicle images.

## Release verification
- PR #11: `Hotfix: restore Saleh listing prices`.
- Core consolidation QA: green.
- iOS export: green.
- Android export: green.
- Web export: green.
- Live Render source diagnostic: green.
- Live public Dalelah API check: green for Yaris Y, Y-Plus and Y Limited prices.

## Phase 2 continuation
Existing Phase 2 workstream: `dalelah-phase-2-vehicle-data-intelligence` / draft PR #7.
It contains the mileage intelligence foundation but predates the latest Saleh production hotfixes. Before continuing Phase 2, refresh it from current `main` so Haraj price, Syarah price, Saleh live inventory, Saleh images and Saleh price fixes are preserved.

Recommended next product sequence:
1. Refresh Phase 2 from current main.
2. Validate live Haraj mileage coverage.
3. Add mileage normalization to other sources.
4. Build evidence-based market valuation using year + mileage + verified price.
5. Add Dalelah Deal Score only after valuation quality is proven.
