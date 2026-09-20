# Production-path progress response refinement

Candidate only; not deployed. The edited server file was compared byte-for-byte against candidate commit 2a8ae8af79d57d2afa78769b4905886af53c28fc before the targeted change. The baseline matched.

Root cause: GET /api/search/progress/:id called advanceFull and awaited an upstream progress fetch with a seven-second timeout. Existing validated local results could therefore wait behind a slow legacy response. Concurrent polls could also repeat the same upstream refresh.

Change: retain the existing refresh logic and network timeout, but share one refresh promise per search job and wait at most 60 ms for it before serializing the current public job. The refresh continues and becomes visible on subsequent polls. No unfinished job is marked complete; no source data is accepted through a new path. A finished or failed refresh releases the slot.

Verification: 460 tests passed; server syntax checked. Dedicated tests demonstrate that existing results and incomplete status return while refresh is blocked, concurrent polls share one refresh, completion updates results, and failure allows retry. The 60 ms value is a wait budget, not measured end-to-end HTTP latency or a guaranteed cold-search latency.

No main merge or Render deployment. Browser, mobile and Render timing validation remain outstanding, as does integrating the isolated new-source trial into the production inventory/retrieval path. This change does not claim to fix the first-source fetch time by itself.
