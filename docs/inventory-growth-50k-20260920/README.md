# Inventory expansion toward 50,000 — 20 September 2026

Status: implemented and locally tested release candidate; **not deployed**. Production baseline: `521b0e961fddb87e57d0627c9451437c4d834602`.

50,000 means fresh, validated, deduplicated searchable vehicle listings. It does not mean discovered URLs, synthetic benchmark records, or a percentage of the Saudi market. The directory has 41 research targets and 12 implemented connectors, not 41 working feeds.

## Changes

- Persistent, source-ID-based discovery queues and 24-hour accepted-ad revalidation. Unfinished work resumes; deleted/sold advertisements can be removed. Rediscovery never refreshes a listing's verification timestamp.
- Source-published sitemaps and observed pagination for Motory, Mstaml, ArabWheels Saudi, Kayishha and SAMACO. Mstaml's mixed sitemap is filtered to Saudi car category `4.41` before detail requests.
- Source-bound redirects, robots handling, three concurrent detail workers per source, crawl pacing and bounded requests. HTTP 401/403/429 stop source work; access restrictions are not bypassed.
- Syarah and existing bulk sources retain their pagination position. Haraj retains unfinished candidates and avoids repeatedly refetching recently accepted ads.
- Proposed scheduled refresh increases from twice daily to every two hours. A run keeps its existing validation-before-publication gate. It does not mean every source finishes its entire inventory every two hours.
- Canonical make/model/source/condition lookup buckets, compiled ranking context and short-lived query caching reduce repeated work. Full relevance, evidence, condition and freshness checks remain in place.
- Expansion CLI checkpoints validated records and pending work atomically after each detail batch; it can resume after interruption.
- Candidate CI and the scheduled publisher validate inventory with a 320 MB Node heap ceiling to block snapshots that outgrow the current service budget.

## Live evidence and actual counts

The completed Syarah probe read page 1, then pages 201 and 202: 36 validated records, mostly already present, **one net additional stored listing**. Its saved continuation starts at page 203.

The staged snapshot contains 3,521 records, of which 3,463 were fresh at 14:04 UTC. Baseline was 3,520 stored / 3,462 fresh. These are candidate counts, not a claim of a new production release.

The persisted discovery queue contains **1,665 known source identities**, including **1,621 pending checks**:

| Source | Known identities | Pending detail checks |
|---|---:|---:|
| Motory | 1,437 | 1,423 |
| Kayishha | 199 | 192 |
| Mstaml | 7 | 6 |
| SAMACO Automotive | 13 | 0 |
| ArabWheels Saudi | 9 | 0 |

These saved identities came from existing accepted records and captured public source sitemaps. The pending totals are not accepted inventory. Discovery can continue from each source's entry page and declared sitemaps.

A larger live collection emitted progress showing at least 114 accepted Motory, 194 Kayishha and 35 ArabWheels records. The workspace then blocked network access to `https://ksa.motory.com:443` before the batch persisted its final records. **Those observations were not imported, counted as durable inventory or published.** Batch checkpointing was added afterward and tested so future interrupted runs retain completed batches.

## Verification

- 496 automated tests passed, including source evidence, classification, condition, strict search filters, resumable queues, sold-ad removal and checkpoints.
- The staged real inventory passed the complete inventory/model validation under the 320 MB heap ceiling. Exact counts and local latency distribution: `validation.json`.
- Earlier candidate `f0200cd8c304809ba799a226ccb469111df1abd0` passed GitHub regression, Arabic/English progressive-image desktop/mobile checks and iOS/Android/web builds (run 35514507206). The final candidate contains additional checkpoint/removal safeguards and needs its own CI result; an earlier run is not presented as final-commit validation.
- Source presence metrics are in `qa.json`. Image HTTP success, image resolution and link HTTP success are null where not measured for the complete snapshot. Image URLs are not proof of a successful live image download.

## 50,000-record capacity result

`synthetic-capacity.json` is a synthetic, memory-only capacity test; none of its generated records were written to production inventory. It used independently serialized records with real gallery fields.

50,000 indexed records: ~4.9 s initialization; exact make/model cold lookups ~13–78 ms; a broad used/mileage query ~3.6 s cold and 16 ms repeated. These are local index timings, not end-to-end browser/AI/network latency. Heap measured after the query set was approximately 608 MB, and the same fixture failed with a 256 MB heap limit.

The production frontend plan reports 512 MB; the secondary search service reports a free plan. **50,000-record production capacity is not yet certified.** More memory optimization or an explicitly approved hosting upgrade is required before that volume is released. No paid resource changes were made.

## Remaining work before release

1. Restore authorized source-network access and complete the checkpointed live collection and source QA.
2. Validate the final resulting snapshot and candidate CI, including New/Used and Arabic/English checks.
3. Merge only after critical gates pass; verify both Render SHAs, the public domain and live inventory counts.

Current source limitations remain visible: CarSwitch can return HTTP 202 on later pages; the Saudi Sale bulk parser still has low acceptance; some directories/catalogs are not individual stock feeds. Haraj, OpenSooq and Saleh Cars remain enabled for live lookup despite zero fresh stored records in this snapshot. Full market coverage and the 50,000 target have not been reached.
