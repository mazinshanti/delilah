# Connector repair — 2026-09-21

Preview experiment only; production main and inventory are unchanged.

OpenSooq verification now requires a matching canonical ad ID, primary listing ID/category, exactly one matching Vehicle schema, matching title and in-stock offer, and condition from the primary specification panel. Its HTTP schema references are matched by exact source/ad identity; network requests still use HTTPS. Unrelated recommendation fields cannot supply condition. Non-SAR prices remain unknown.

Within the existing fair per-source detail queue, known make/model matches now rank above unknown cards. Final eligibility rules remain strict.

Live isolated Toyota Corolla used-car searches returned two OpenSooq ads (2008, SAR 17,000; 2018, SAR 48,000) and one Kayishha ad (2024, 16,000 km, price unknown). See live-results.json for URLs, timings and diagnostics. Unknown prices do not qualify for a budget-filtered result.

These diagnostics allowed 75 seconds per source. First results took 49.6 seconds on OpenSooq and 47.3 seconds on Kayishha, exceeding the deployed 30-second request budget. This proves live detail verification, not satisfactory deployed latency or complete source coverage. No paid search API was configured. Further latency work is required.

Validation: all 519 repository tests passed, including five new parser and candidate-priority checks. No page or image archive is committed.
