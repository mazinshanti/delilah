# Dalelah Saudi Data Residency

Status: mandatory for Dalelah Sell before public seller/customer data collection.

## Decision
All personal seller/customer data and marketplace transaction records must be stored on infrastructure physically located in the Kingdom of Saudi Arabia.

Preferred first implementation: Google Cloud SQL for PostgreSQL in Dammam (`me-central2`). Google documents Cloud SQL for PostgreSQL availability in `me-central2`, and KSA customers access the Dammam region through CNTXT.

Alternative Saudi-hosted option: Oracle Cloud Infrastructure in Riyadh (`me-riyadh-1`) or Jeddah (`me-jeddah-1`). OCI currently operates both Saudi regions and explicitly positions them for local data residency.

AWS is not the current primary choice because, as of September 2026, AWS still lists the Kingdom of Saudi Arabia region as announced/coming soon rather than generally available.

## Architecture rule
- Public website/application compute may be separated from the data tier if needed.
- Seller name, phone, email, VIN-linked ownership/contact data, leads, offers, transaction records, verification records and audit logs must persist only in the Saudi database/data services.
- Public vehicle cards must never expose seller contact data directly from the database.
- Images that contain personal data should also use Saudi-region object storage when enabled.
- Mojaz/inspection/partner integrations should store only the minimum returned data required for the product and must preserve provenance and consent state.
- No production seller data may be written to Render Postgres in Frankfurt.

## MVP migration target
1. Provision Saudi-region PostgreSQL.
2. Create seller, vehicle, listing, lead, offer and consent tables.
3. Connect Dalelah Sell API via environment-based database configuration.
4. Add encryption in transit, least-privilege database credentials, backups and audit logging.
5. Add PDPL consent/privacy notices before accepting the first public submission.
6. Test create/read/update/delete flows and verify no seller PII is returned by public listing endpoints.

## Regulatory baseline
Dalelah will process personal data of individuals in Saudi Arabia, so the Saudi Personal Data Protection Law (PDPL) applies. Cloud deployment should also be reviewed against current CST cloud-computing regulations and applicable NCA/security controls before commercial launch.

This document is an engineering policy, not legal advice. Saudi legal/privacy review is required before commercial launch.
