# Immediate inventory milestone: 10,000

The user selected 10,000 fresh, valid, deduplicated searchable listings as the immediate milestone. The longer-term target remains 50,000. Collector reports now distinguish these targets. No target is used to fabricate inventory or weaken acceptance rules.

## Capacity test

Command: `BENCHMARK_RECORDS=10000 node --max-old-space-size=320 --expose-gc scripts/benchmark-inventory-scale.mjs`

Passed with 10,000 synthetic records, approximately 157 MB heap measured after queries and 1,282 ms initialization. English/Arabic exact-model cold lookups: 3–20 ms. Broad new/budget lookup: 225 ms. Broad used/mileage lookup: 753 ms cold, 2 ms repeated.

This is a local index benchmark with real gallery-shaped fields and independently serialized synthetic records. It is not a full-server load test, a guarantee of peak RSS below the 512 MB hosting limit, or evidence that 10,000 real cars have been collected. Production inventory was not changed.

## Release state

Expansion implementation is saved on `haraj-coverage-expansion-20260919`. Preceding candidate `f060cb121fccd66b74404ad3780945ac15ff03f1` passed 496 tests and GitHub Arabic/English desktop/mobile image checks and mobile builds (run 35515502193).

Main was rechecked and remains `521b0e961fddb87e57d0627c9451437c4d834602`. Live expanded-source validation remains incomplete because the workspace blocked a Motory network request. No source-network restriction has been bypassed. No production deployment or paid hosting change was made.

Saved counts from the prior measurement: 3,462 fresh baseline listings, 3,463 staged fresh listings, and 1,621 additional URLs awaiting verification. Counts are timestamped historical measurements, not a new live inventory count. See the adjacent inventory-growth-50k-20260920 report for queue details and limitations.

Next release gate: restore authorized source-network access, resume the checkpointed collection, validate the resulting real inventory, then publish and verify production. Reaching exactly 10,000 is not required to release a fully validated expansion.
