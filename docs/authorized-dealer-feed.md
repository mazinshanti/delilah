# Growing Dalelah inventory using licensed dealer feeds

Dalelah's 12,438 indexed records are **not** the whole Saudi used-car market. Source coverage, permitted reuse and freshness must be measured independently.

## Permissions first

Haraj's published terms restrict copying and republishing advertisements from its platform, so don't use this dealer-feed adapter to harvest Haraj content. Obtain a licensing arrangement or another explicitly authorized integration instead.

For a dealer-owned source, get written confirmation that Dalelah may **index and display** its vehicle listings, and confirm the exact dealer-owned hostnames and permitted expiry. The manifest is an **operator attestation**, not independent proof or a substitute for a signed agreement.

## Input

`partner-permission.json` (illustrative example only — do not claim a grant that does not exist):

```json
{
  "source": "Example Dealer",
  "authorizedDomains": ["inventory.example-dealer.sa"],
  "authorization": {
    "indexingApproved": true,
    "displayApproved": true,
    "grantedBy": "Example Dealer",
    "agreementReference": "real-signed-agreement-reference",
    "validUntil": "2027-12-31"
  }
}
```

`partner-cars.json`:

```json
{
  "listings": [
    {
      "url": "https://inventory.example-dealer.sa/cars/example-123",
      "title": "Toyota Corolla 2022 for sale",
      "make": "Toyota",
      "model": "Corolla",
      "year": 2022,
      "condition": "used",
      "price": 65000,
      "currency": "SAR",
      "mileage": 72000,
      "city": "Riyadh",
      "image": "https://inventory.example-dealer.sa/photos/example-123.jpg"
    }
  ]
}
```

## Import (offline; does not mutate Render or the current snapshot)

```sh
node scripts/import-authorized-dealer-feed.mjs \
  --feed partner-cars.json \
  --manifest partner-permission.json \
  --snapshot data/market-inventory.json.gz \
  --output data/market-inventory-candidate.json.gz
```

Pass `--dry-run` to validate and count records without writing an output file. The importer rejects unauthorized domains, off-site links, non-sale records, missing/invalid price/year/condition, duplicates and attempts to overwrite the original snapshot. It preserves previous source records and diagnostics.

This candidate file must be checked for freshness, rights, source-domain validation, and actual incremental unique listings before any merge/deploy. The report's counts represent distinct **listing URLs**, not distinct physical vehicles or total market coverage. An empty feed is never proof that previous listings were sold. Follow-up verification must address expired advertisements.

Do not put signed agreements, API keys, or sensitive personal seller information in GitHub. A private review of the actual agreement is required before turning on any scheduled imports.
