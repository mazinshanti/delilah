# All-source connection pass — 21 September 2026

Scope: 37 registry entries plus four discovery targets (41 total). A named source, readable home page or model catalog is not proof of usable live stock.

The on-demand preview now wires all 12 existing primary inventory/search source adapters: Haraj, OpenSooq, Syarah, CarSwitch Saudi, Saudi Sale, Mercedes-Benz Saudi, Saleh Cars, Motory, SAMACO Automotive, ArabWheels Saudi, Kayishha and Mstaml. Four previously missing connections were added: OpenSooq, Mercedes, Kayishha and Mstaml. They share trusted-host transport, strict listing identities, original-ad verification, existing condition/price filters and bounded verification budgets. Hosted discovery remains disabled without credentials.

The authenticated preview source directory exposes all 41 targets and distinguishes adapter readiness from verified live yield. No target is promoted to live-verified by registration alone. Other dealer directories are not counted again as independent marketplaces.

Read-only current readiness audit: 29 readable pages, three redirects requiring review, two HTTP 403 responses, five unavailable robots checks, two authorization-pending sources. All 41 outcomes are in readiness.json. Audit scripts do not import stock.

- Dubizzle and OTM retain their existing authorization-required gates. No requests for permission were sent to those businesses.
- YallaMotor and Almajdouie returned HTTP 403; no bypass attempted.
- Audi Approved, VW Certified, Hatla2ee, GMC Certified and Expatriates could not complete robots checks.
- Additional inspection of Al Jazirah's observed stock route found it disallowed by robots.
- BMW's used-stock HTML loaded but supplied no observed individual stock links in the inspected page.
- Carly rendered an AutoDealer schema and client-side application, with no individual vehicle links in initial HTML.
- Syarati's listing page uses image-generation query URLs; its inspected detail page has no vehicle JSON-LD. Treat stock authenticity as unverified, not proven fake and not importable.
- Khaled's existing reviewed pages are dealer offers with starting prices, not confirmed individual vehicle stock. Existing review-only boundary remains intact.

Live targeted probe of the four added adapters: OpenSooq discovered 12 candidates, Mercedes 24, Kayishha 163 and Mstaml four. These are discovery candidates, not accepted vehicles. The narrow bounded probe accepted zero matching detail-verified vehicles: some lacked exact matching evidence and others exceeded deadlines. See live-probe.json. A separate broader Mercedes proof is recorded when available. No claim of coverage growth or 50,000 inventory is made.

Validation: 514 repository tests passed after adapter wiring; regression fixture checks cover nested exact Offer/Car bindings, sold exclusion, foreign-currency price exclusion, regional URL restrictions and redirect safety. Final preview deployment is separate from production; production sources and main remain unchanged.

Remaining integrations need source-specific parsers, usable feeds or authorized access. The audit is complete; universal live source connectivity is not.
