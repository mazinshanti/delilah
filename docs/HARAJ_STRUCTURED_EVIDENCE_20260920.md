# Exact-ad Haraj structured evidence recovery

User-run baseline: 182 unique discovered, 174 checked, 40 accepted in 454094 ms.
First result among queries with accepted cars: 8498–29801 ms. Ford F-150 had no
accepted result. These are trial measurements, not production search timings.

Haraj's JSON-LD metadata can be sparse while its public React Router payload
contains explicit `carInfo` fields. On ad 11174107507 the title was Toyota corolla,
description blank, and exact-ad carInfo identified CAR / SELL / USED / model 2013.
The previous parser rejected missing_title_year. The updated parser obtains year,
condition and vehicle category from that exact ad's payload. Local live-page
extraction now produces Toyota Corolla 2013 used. Price and mileage remain null;
this patch does not parse numeric commerce fields from the payload.

The parser uses JSON decoding only, matches the same-origin ad ID and exact title,
requires a unique matching CAR/SELL record, rejects conflicting year/condition,
and retains the existing vehicle classification and canonicalization gates.
No page scripts are executed. No recommendation metadata is carried forward.

393 automated tests passed, including foreign-ad, wrong-title, non-car/non-sale,
duplicate payload, year/condition conflict and non-vehicle negative fixtures.

`scripts/haraj-evidence-recheck.mjs` rechecks at most 12 unique previously rejected
Haraj URLs, round-robin across saved queries. It uses rules-only intent, preserves
constraints and source pacing, makes no AI calls and writes no production data.
Its pending live results are required before claiming wider recovery. A previously
rejected ad becoming accepted may also reflect a source edit between runs.

Changes are on the isolated candidate branch only. No merge or deployment.
