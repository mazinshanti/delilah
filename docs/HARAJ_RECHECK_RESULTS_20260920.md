# User-run exact-ad evidence recheck

Candidate tested: 6eb146425bf4f335cc612d7acfb12e635eb60ba3.
12 previously rejected Haraj advertisements checked; 8 recovered; 0 AI calls;
14887 ms total. This is a selected rejection sample, not a full-market acceptance
rate or a fresh complete benchmark. The earlier full session remains 40 accepted
in 454094 ms. Do not report a new full-session count or speedup from this sample.

Recovered IDs: 11179875591, 11184773448, 11175693748, 11186159920,
11187978982, 11176039727, 11177427637, 11174107507.

Remaining IDs and local read-only follow-up:
- 11188271950: sparse title/description; no eligible exact structured year.
- 11186562435: structured model 2011 recovered, condition still unknown.
- 11185340600: title identifies 2023, condition still unknown.
- 11176046134: description contains explicit `&ndash; موديل 2024` after the
  vehicle name. Year extraction now handles separator-delimited year labels,
  retaining conflicting-year rejection. The next boundary rejects the phrase
  `سيدان فاخرة مطلوبة` as WANTED_VEHICLE. This is a potential contextual false
  positive requiring separate negative/positive regression coverage; the
  classification gate has not been relaxed or changed.

The recovered Patrol and Corolla ads describe multiple trims. They require
further offer-scope review before claiming per-trim prices or completeness.
Missing mileage and price remain null; this patch adds no numeric inference.

Validation: 18 collector tests passed, including inline Arabic/English explicit
year labels, unrelated maintenance years, and conflicts with the title year.
The prior structured-evidence change passed all 393 tests before this small
year-label follow-up. No production merge or deployment.
