# Mstaml Saudi individual-ad trial integration

Implemented a source-specific reader and connected it to the isolated market discovery pipeline. Production remains unchanged. This is not a site-wide inventory count or completed production connector.

The reader requires a Saudi product route, one numeric query ID, matching Product SKU and Offer URL, matching main heading, explicit car category, available SAR offer and an explicit for-sale field. Related products, wanted ads and non-car classified ads cannot substitute for the primary listing. Observed query identity is preserved and locale/slug variants deduplicate by numeric ID. Existing source pacing, robots checks, bounded reads, classification and query filtering remain active.

Only primary labelled specs are extracted. Unknown city stays null. Conflicting odometer evidence stays null even after repeated inventory normalization, including mileage ceiling filtering. Bidding/installment description language suppresses the numeric offer price. New condition plus evidence of usage is rejected. Gallery URLs are observed source assets, never guessed upgrades.

Validation: 451 automated tests passed before the additional new-condition conflict guard; all five dedicated adapter tests passed again after that guard. A fresh public detail fetch on 2026-09-20 accepted one Toyota Yaris 2015 used ad, with seven gallery URLs. Price and mileage remain null because of bidding language and conflicting odometer values. The direct read took 20.123 seconds including robots fetch; this is not an acceptable production first-result target. Image downloads and full-source coverage are not verified.

Evidence: qa-20260920/mstaml-live-detail.json. No raw source HTML or seller contact details are committed. No individual ad is hardcoded in the adapter. Discovery can now pass grounded Mstaml ad URLs to this reader; a category-page traversal adapter and broader live sample remain pending. Arabic source labels are currently supported; unsupported layouts fail closed.

Existing directory checkpoints include registry access status in their plan. Start a new checkpoint after this source-status update rather than rewriting saved reports.
