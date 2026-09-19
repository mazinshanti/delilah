# Dalelah — saved stopping point

User requested saving work and resuming tomorrow. No background work or scheduled reminder requested.

## Current state
- Production website: https://www.dalelah.co/ . No production deployment or main merge performed in this experimental chain.
- Candidate branch: haraj-coverage-expansion-20260919.
- Latest implementation commit: 3cf6c82cc4afb5754ce53c92b598c5f2bc510db9.
- Latest prior report commit: a920de0b19dff8a5668c164bbae57984f315f369.
- Preserve Haraj, existing classification/quarantine/canonicalization, all existing UI and architecture. Do not deploy partial work.

## Completed and measured
- User's full Render AI session: 113 unique discovered, 108 checked, 25 accepted in 463654 ms; CarSwitch 19, Haraj 4, Syarah 2. This predates latest route/performance changes.
- Fixed English Haraj URL discovery, Saudi Sale locale/index.php identity, source inventory category routes and double-encoded Arabic discovery paths.
- Added isolated Saudi Sale HTML detail parser. Live new Corolla accepted; used Audi sample still fails. Never infer missing condition or specs.
- Up to three independent-source workers; requests within each origin remain serialized with robots pacing and source restriction pauses.
- Direct accepted ads emitted before category traversal. Session cache bounded to 20 MB, keyed by canonical ad identity.
- Follow observed same-origin next-page anchors only; six discovery pages by default, shared across rounds. No complete coverage claim.
- Live three-ad sample: before total 68040 ms / first result 23840 ms; after total 23600 ms / first result 20497 ms. Same three accepted in both runs. Excludes AI provider latency; single sample, not production SLA.
- Syarah MG ZS: 12 links on page 1 and 11 additional links on page 2. Additional links are not detail-verified accepted inventory.
- Full suite 388 tests passed; focused tests passed after final stop-condition adjustment. No full Render AI rerun after these changes.

## Resume next
1. Verify branch/main/Render baseline before further edits; last historically known production SHA be7670e5d962319b34aa2ea55e2a1b2ffeb7aca5 is not a current verification.
2. Update user's temporary Render trial checkout to latest candidate files, including lib/saudisale-detail-trial.js, lib/ai-market-discovery-trial.js, lib/source-registry.js and scripts/ai-market-session.mjs.
3. Run bounded focused AI comparisons, then complete 12-query benchmark if results warrant it. Measure first useful result, total time, unique accepted ads and per-source rejection reasons. Do not conflate discovered links with accepted cars.
4. Improve first-result latency (still about 20 seconds in source-only sample), evidence extraction and broader coverage. Current trial has five supported source adapters; other sources are not silently enabled.
5. Investigate Saudi Sale used-template failures and Mercedes redirect identity; retain evidence gates. Add other adapters only after validating access and exact listing evidence.
6. Production integration, required Arabic/English mobile/desktop regressions, main merge, Render deployment and live SHA verification remain unfinished. Do not claim deployed.

## Environment and reproducibility
Working tree: /workspace/scratch/ea6dcabf1b84/dalelah-haraj-release. GitHub MCP publishes candidate files; local HEAD does not reflect all remote commits. Local uncommitted and untracked files include earlier candidate work; do not reset or discard them. data/market-inventory.json.gz has a separate unpublished 113-Haraj snapshot; do not deploy it inadvertently. Original sibling repository contains unrelated UI/valuation edits; preserve them.

OPENAI_API_KEY is available in the user's Render Shell, not locally. User executes provider trials and shares JSON; never request or print the key. No direct control of their Render Shell is established. Code/reports are persisted to GitHub; temporary HTML/proxy fixtures may disappear and can be refetched.

References: docs/ai-market-session.md, docs/market-speed-sample-20260919.json, docs/market-pagination-sample-20260919.json, docs/market-session-observed-20260919.md. The older attached September 9 handover is not the latest production baseline.
