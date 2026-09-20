# Saudi source discovery directory — 2026-09-20

Candidate only; not deployed. 39 source/page targets, not 39 connected inventories or unique domains. Includes all 36 existing registry entries and three additional sources. Two open discovery tasks follow targeted searches. No assertion that all Saudi sellers have been identified or all ads indexed.

New first-party pages inspected:
- Khaled Cars https://khaledcars.com/ar — priced vehicles, new/used navigation and Riyadh branches.
- Thil Al Jazeera https://tj4cars.com/ — public vehicle sales site.
- GCC Car Deals https://gcccardeals.com/en-sa — Saudi comparison pages; original seller provenance still needed.

Also rechecked Motory https://ksa.motory.com/ar/, Hatla2ee https://ksa.hatla2ee.com/en/car, ArabWheels https://www.arabwheels.sa/, Saleh https://www.salehcars.com/en. UVI could not be fetched; Carly exposed only a script shell. Existing access/status constraints remain unchanged.

The prior uploaded Render report showed 152 accepted vehicles, 398 external URLs and 64 external hosts. External leads included unrelated discussion, encyclopedias and PDFs. These are not new connected inventory sources.

Changes: open search receives the full directory as guidance, not an allowlist. Dedicated source-directory runner searches each target independently using provider domain filtering and exact target instructions; saves a checkpoint after each call, resumes on the next run, and retains failure diagnostics. Default six calls per run; at most two web tool calls per request. Open discovery remains at end of plan. Tracking parameters are removed from collected leads; pagination preserved. Editorial/document leads retained but separately marked. No source is auto-enabled and no new external record enters inventory.

Run on a complete candidate checkout in the configured environment:

    node scripts/ai-source-directory-session.mjs 'Toyota Corolla' /tmp/dalelah-corolla-directory.json 6

Repeat the same command to resume remaining targets. Report planComplete means scheduled queries completed, never exhaustive inventory coverage. 126 automated tests passed. Live provider run pending; no local API credential. Full production integration, new-source parsers and live image verification remain incomplete.
