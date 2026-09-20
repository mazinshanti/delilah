# Open-market AI discovery — 2026-09-20

Candidate-only change; production remains unchanged.

## Cause
The session runner restricted provider searches to five connected domains. Grounded URLs on additional domains were counted then discarded. This prevented discovery of new Saudi marketplaces and dealer inventory.

## Change
The session benchmark now explicitly selects open-market discovery. The provider web-search tool omits allowed_domains in this mode; existing default connected/Haraj modes remain restricted. Instructions request Arabic/English aliases, Saudi cities, new marketplaces and dealers, with previous external hosts in feedback. Grounded external URLs are deduplicated and retained in each case and the session report. Novel external leads keep discovery rounds progressing even if connected-source results are empty.

New leads remain unvalidated-source with vehicleVerified=false and saudiMarketVerified=false. They are not fetched automatically, counted as accepted cars, or inserted into inventory. Existing connectors still validate supported advertisements. Source access controls and vehicle filters are unchanged. Generated answer text is never used as URL evidence.

Limits: 60 external leads per provider response, 240 per case; session retains existing 12 cases, one seed round and two provider rounds per case, up to 48 provider tool calls. This is bounded discovery, not exhaustive market coverage. New source extraction adapters and source-specific validation remain necessary to turn external leads into accepted listings.

## Validation
123 targeted automated tests passed, including default provider restrictions, open-mode payload, grounded-only extraction, unsafe URL rejection, deduplication, round continuation, no external auto-fetch/admission, Haraj classification and cache regression.

No live OpenAI provider run performed in this workspace: API credentials are available in the user's Render service only. No production deployment or coverage/speed improvement claim is made.

## Run
Using a complete checkout of this candidate revision in the configured environment:

    node scripts/ai-market-session.mjs /tmp/dalelah-open-market-session.json

Report externalDiscovered and externalSourceCount separately from uniqueAccepted. Review externalCandidates for onboarding. Do not compare discovered leads to validated vehicle counts.
