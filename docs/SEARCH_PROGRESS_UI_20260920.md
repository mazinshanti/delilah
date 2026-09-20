# Search progress UI — candidate only
- Added a compact native progress element under the existing search form, using current theme colors.
- Active searches remain indeterminate: no invented time/coverage percentages. Completion fills only on confirmed non-partial backend completion.
- Cached inventory completion cannot finish an active broader search. Partial/failed completion displays retry guidance without a full bar.
- Fixed progress polling clearing the busy state before backend completion.
- Arabic/English labels, RTL-compatible sizing and reduced-motion styling.
- Verified baseline HTML/JS/CSS matches candidate a4c4a0bb25fa87c23d1246d8a9832bd40b37fe2c before edits.
- Validation: 463 automated tests passed; UI module syntax passed.
- Browser QA attempted but blocked by missing Chromium executable. Desktop/mobile visual verification remains outstanding.
- Not merged to main or deployed; production gates remain required.
