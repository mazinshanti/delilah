# Dalelah core runtime roles

Dalelah 1.5 now supports two explicit runtime roles from the same release:

- `front` (default): runs `server-core-candidate.js`, which returns direct Haraj/OpenSooq/Saleh results first and progressively enriches them from the deep backend.
- `legacy-deep`: runs `server-v15-marketplace.js`, preserving the proven legacy search chain for fallback/deeper coverage.

Production topology:

- `delilah` / www.dalelah.co: `DALELAH_RUNTIME_ROLE=front`
- `delilah-live-search`: `DALELAH_RUNTIME_ROLE=legacy-deep`
- Front fallback: `DALELAH_LEGACY_BASE_URL=https://delilah-live-search.onrender.com`

This prevents recursive self-calls when both services deploy from `main` and lets the legacy chain be removed incrementally after the direct core reaches source parity.
