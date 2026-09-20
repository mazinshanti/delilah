# Dealer discovery seeds and Dubizzle access review

Candidate branch only; no production release.

The verified Haraj showroom pages for 4Cars, Nojoom Al Falah and Ramz Al Asalah are now registered as trial-discovery routes and automatically appended to catalog-recognized searches. The initial Haraj/Syarah/CarSwitch seed ordering is unchanged. Existing per-source pacing, page/detail budgets, continuation queues, duplicate identities, quarantine and query constraints apply. These are three dealer entry points through Haraj, not three independent marketplace feeds. Listing attribution remains Haraj; page ownership is not asserted as independently verified seller identity.

Validation: 446 tests pass. Earlier live evidence remains in qa-20260920/dealer-detail-recheck.json: 61 observed dealer-page links, six details sampled, one accepted. No new live success or production latency measurement is claimed for this seed-planning change.

Dubizzle official Saudi terms were rechecked on 2026-09-20:
https://help.dubizzle.sa/hc/en-us/articles/4404851931279-What-are-the-terms-of-use

The terms restrict scraping/compiling its content and require a licence for commercial content use. Its public Saudi car category is readable, but no authorized inventory API or feed was established. Its authorization-required status is retained. No credentials, undocumented API, bypass or scraping adapter was fabricated. User authorization to modify Dalelah does not itself establish permission from Dubizzle.

Other dealer entries retain their measured access states. Catalog pages, auction bids, business directory profiles, and unreachable inventory routes are not counted as verified stock. See SOURCE_INTEGRATION_READINESS_20260920.md for individual limitations. Existing saved directory checkpoints whose plan includes registry statuses must be started with a new output path after this registry update; do not silently rewrite their fingerprint.
