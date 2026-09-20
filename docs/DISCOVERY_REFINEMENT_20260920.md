# Discovery refinement after the 8/12 recovery sample

Changes remain isolated on the candidate branch; no production deployment.

1. Wanted-ad classification now exempts only a standalone descriptive clause
   such as `سيدان فاخرة مطلوبة | ...` in the description. Wanted signals elsewhere
   in the description, title or category still reject the listing. The observed
   exact Haraj page 11176046134 now parses as Mercedes C-Class 2024 used, 20205 km,
   price null. This is an import advertisement; no domestic physical location or
   all-inclusive delivered price is inferred.
2. Haraj advertisements explicitly offering multiple trims in their title no
   longer assign the first extracted asking price to the whole listing. Prices
   remain null until they can be associated reliably with a specific offer.
3. Category traversal uses the completed page's worker slot to check its first
   advertisement while other source pages are pending. Check reservations are
   synchronous, preserving the detail budget and deduplication. Existing per-host
   serialization, robots checks and overall worker bounds remain in force.

Regression coverage includes real wanted phrases, ambiguous purchase text,
multi-trim prices versus a single-car cash price, and a controlled slow-source
test proving a validated result emits before the other page completes.

Automated suite: 396 passed. Production search latency is not measured by this
test and no new live AI benchmark has been run. Previous observed full session:
40 accepted / 174 checked / 454094 ms. Separate Haraj recheck: 8 recovered from
12 rejected ads / 14887 ms / zero AI calls. Do not combine these into a new
full-session benchmark or claim complete market coverage.
