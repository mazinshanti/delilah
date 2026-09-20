# Source stability and early results — candidate only

Changes to the read-only all-source trial:
- Start known source search pages concurrently with provider discovery; validated matches can emit before AI discovery finishes.
- Keep all 41 directory targets and unrestricted Arabic/English discovery; seed pages are an early-results path, not a source whitelist.
- Process at most six details per validation batch and up to three source pages, preserving pending work and the global check budget.
- Reuse the existing ten-minute validated-results cache and reapply hard query constraints. Only freshly checked records renew cache timestamps; checkpoint observations do not.
- Retry temporary HTTP 5xx, empty responses and fetch failures on continuation, up to three total attempts. Rejected vehicles and access-denied responses do not become retry candidates.

Validation: final full suite passed all 443 automated tests, including ten directory pipeline tests.

The first live workspace sample (two-page allowance, six detail checks, no AI provider) accepted five Syarah records. First result 50,043 ms; total 87,702 ms. One detail fetch failed. Warm validated cache emitted in 3 ms (5 ms total). These are backend timings, not browser rendering or Render performance. Cold latency remains unacceptable and must not be described as resolved.

The sample exposed deferred traversal of the third seeded source. The candidate now permits all three seed pages in the first batch. A second live sample tests that change with three detail checks. Different check budgets and uncontrolled source response times prevent percentage-speedup claims.

No production deployment or main merge. No claim that all source connectors are operational. The full directory provider run requires the configured Render environment; this workspace has no OpenAI API key.

Second live sample: Haraj, Syarah and CarSwitch each accepted one record. First result 24,764 ms; total 26,766 ms; three checks, three accepted, 54 pending URLs. This remains too slow for initial interactive results and is not a production speed guarantee.
