# Retain listings until confirmed sale or removal

Age no longer excludes a listing from search or discards it when the scheduled collector loads the previous snapshot. The 36-hour threshold now flags refresh work; results expose lastCheckedAt and refreshDue, and cards/details display the observation time. Fresh-only valuation inputs remain unchanged. Source counts and refresh reports distinguish retained searchable inventory from recently observed inventory.

Existing additional-source queues continue checking old listings. Haraj now queues old retained ads even when discovery no longer returns them. Bulk sources get a bounded, robots-aware exact-detail recheck (up to 100 details and two minutes per source per run), persisted retry times, and separate diagnostics. A successful page whose evidence cannot be parsed retains the old record and does not renew its timestamp. Direct 404/410 or an explicit unavailable status bound to that exact car permits removal; timeouts, 202, 403, 429, 5xx, missing cards, and ambiguous pages do not. Redirect-target deletion errors in the additional collector do not establish removal of the original URL.

City filtering now normalizes supported Arabic and English aliases. A narrowly negated Arabic outstanding-requirement phrase no longer triggers wanted-ad rejection; actual buying requests still do. Haraj negative sold statements are not sale confirmations. The remaining unresolved-identity and sale-evidence cases have not been indiscriminately accepted.

## Evidence

Replaying the 2026-09-21 14:41:58 UTC candidate at its original observation time yields 4,473 searchable ads, 3,669 fresh ads, and 804 retained ads due for refresh. Riyadh and الرياض each return 2,767 retained ads. This is a policy replay of the saved snapshot, not a new source crawl or proof of current availability.

Validation covers freshness transitions through cached results, exact sold/removed evidence, error retention, retry schedules, changed prices, source-bound status evidence, city aliases, Arabic negation, and Haraj old-ad rechecks. Repository and experiment suites are run before commit. No production data snapshot or deployment configuration is changed.

The scheduled production collector will use this behavior only after this change is promoted. Source-specific details that do not expose parseable status or data stay marked as needing refresh; missing evidence is never reported as a successful availability check.
