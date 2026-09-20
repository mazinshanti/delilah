# Source-reader speed refinement

Candidate only; no production deployment or browser speed claim.

Implemented bounded successful-response caching (20 MB maximum), fixed 60-second detail TTL and 15-second discovery TTL. Concurrent identical URL requests share one promise. Failures are never cached. Existing pacing, robots restrictions, redirect identity checks and query filtering remain in place. Default trial sessions share a reader within the process, rather than rebuilding the cache on every invocation. Robots policies refresh every ten minutes. Restricted/limited sources pause for ten minutes instead of remaining disabled forever in a long-running reader.

Fresh Mstaml source-read benchmark, 2026-09-20:
- Cold read and parse: 14,826.65 ms, two network requests, one accepted record.
- Warm read and parse: 2.71 ms, zero network requests, one accepted record.
- Repeated read and parse: 1.74 ms, zero network requests, one accepted record.

These are workspace source transport timings, not Render timings, AI discovery timings, or browser rendering measurements. The cold value remains too slow to sign off the release. The saved benchmark precedes the shared-reader lifetime change; that change is covered by deterministic expiry/pause tests, not a claimed additional live speed gain.

455 regression tests pass, including duplicate request sharing, non-sliding expiry, byte-budget eviction, failed-request retry, robots refresh and source-pause expiry. No UI, seller, valuation, inventory data or production deployment was modified. The new-source pipeline is still isolated from production request handlers. End-to-end integration and Render/mobile/desktop timing verification remain release gates.

Reproduce source transport measurement with a file containing one supported observed listing URL:
`node scripts/market-reader-speed.mjs /tmp/listing-url.txt /tmp/speed.json`

Evidence: qa-20260920/mstaml-reader-speed.json.
