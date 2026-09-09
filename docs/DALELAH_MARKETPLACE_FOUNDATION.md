# Dalelah Marketplace Foundation

## Product thesis
Dalelah should evolve from a Saudi car search aggregator into the trust and transaction layer for the used-car market. The search engine remains the acquisition engine: it finds cars across marketplaces, dealer feeds and direct partners. The marketplace layer then helps a buyer understand whether a specific vehicle is real, fairly priced, properly inspected and safe to transact.

## What Dalelah should become
1. **Search the whole market** — marketplaces, dealer feeds, certified-used programs and private sellers.
2. **Dalelah Verified** — seller identity, listing freshness, ownership/document checks where legally and technically available.
3. **Dalelah Inspected** — independent inspection report linked to the specific VIN/vehicle.
4. **Dalelah Price** — market median, comparable count and price delta. Never display a deal grade without enough comparable evidence.
5. **Managed transaction** — reservation/deposit, secure payment flow, ownership-transfer assistance and delivery through authorized partners.
6. **Finance / warranty / insurance** — partner products only after regulatory and commercial review.
7. **Dealer and DMS feeds** — Keyloop/Autoline-style integrations and direct dealer feeds become the high-quality inventory backbone.
8. **Private-seller liquidity** — sellers can request an inspection, receive a market valuation and expose the car to consumers and approved dealer buyers.

## Asset-light first
Dalelah should not begin by buying and warehousing large volumes of cars. Owning stock creates working-capital, depreciation, reconditioning and operational risk before the pricing engine is mature. Start as an aggregator + managed marketplace + transaction layer. Add selective instant-buy/trade inventory only after Dalelah has enough data to price risk confidently.

## Canonical inventory object
All adapters should normalize into one schema before search/ranking:
- identity: inventoryId, sourceListingId, VIN
- vehicle: make, model, trim, year, condition, mileage, body, drivetrain, fuel, transmission, colors
- seller: seller id/name/type, verification, branch/city
- commercial: price SAR, VAT state, negotiable, finance availability, monthly payment
- trust: trust level, inspection state/score/provider/date, history state/provider, warranty, return window
- location: city/branch/coordinates
- media: primary image + image list
- provenance: source, source type, ingestion method, original URL, evidence
- freshness: first seen, last seen, updated at, availability

## Trust levels
- `raw`: discovered listing only
- `verified`: seller or history evidence verified
- `inspected`: vehicle passed a Dalelah-recognized inspection
- `certified`: inspected + verified history/seller + eligible warranty

The UI must not label a car as verified/inspected/certified unless the required evidence exists.

## Deal intelligence
Deal scores must be evidence-based. Minimum initial rule: no score when fewer than 3 credible comparables exist. Compare like-for-like by make, model, year/age band, trim where possible, mileage band, city/region, seller type and condition. The first version may use median price and price delta; later versions should add mileage normalization, trim, freshness and seller-quality weighting.

## Revenue model
- transaction/success fee on managed sales
- inspection fee or inspection margin
- dealer subscriptions/feed plans
- promoted inventory, clearly labeled
- finance referral/origination economics where permitted
- warranty/insurance referral economics where permitted
- delivery/logistics margin
- B2B valuation and inventory API/data products
- selective wholesale/instant-buy spread only after pricing risk is proven

## Build order
### Phase A — foundation
- normalized inventory model
- VIN/original-URL deduplication
- trust fields and trust levels
- evidence-based deal scoring
- source freshness and seller identity model

### Phase B — supply
- Keyloop/dealer-feed adapter contract
- direct dealer CSV/XML/JSON importer
- seller submission + VIN workflow
- marketplace adapters continue as discovery coverage

### Phase C — trust
- inspection partner workflow
- vehicle-history/document integrations
- verified seller/dealer profiles
- listing freshness and stale inventory removal

### Phase D — transaction
- offer/reservation workflow
- buyer/seller messaging
- secure transaction orchestration
- ownership-transfer assistance
- finance/warranty/logistics partner handoffs

## Non-negotiables
- Never fabricate price, mileage, year, inspection, history, availability or warranty.
- Preserve original seller/listing provenance.
- Do not bypass access controls or anti-bot restrictions.
- Do not call a vehicle verified or certified without evidence.
- Get Saudi legal/regulatory review before taking custody of customer funds, offering financing, warranties, insurance or acting as principal dealer.
