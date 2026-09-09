# Dalelah authoritative release target

For the next production release:
- Web/API authoritative service: one Render web service running `server-v15-marketplace.js`.
- Public web: `/`
- Mobile functional preview/PWA surface: `/mobile`
- Sell experience: `/sell`
- Search API: `/api/search` and `/api/search/progress/:id`
- Marketplace status: `/api/marketplace/status`
- Seller PII submissions: disabled unless Saudi-hosted storage is configured.
- Native mobile source: `/mobile` directory, built with Expo for iOS and Android.

The standalone Expo web static preview is QA-only and must not be treated as the public mobile product URL.
