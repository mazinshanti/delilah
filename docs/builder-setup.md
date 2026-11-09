# Dalelah × Builder.io (visual editor)

This is a **limited visual-editor integration**, not a migration of Dalelah's search engine.

## One-time setup in Builder Content

1. Open your Builder.io **Content Space** (the one whose Content Public API Key you provided).
2. Open **Models** → **+ New Model** → **Section**.
3. Set **Name** to exactly `dalelah-home-section` (lowercase with hyphens). Keep this name stable.
4. Set the **Preview URL** to `https://www.dalelah.co/builder-preview`.
5. Create a new content entry in that Section model and drag in text, images, buttons, and layout blocks.
6. Preview changes inside Builder's visual editor. **Do not publish** until you are ready for them to appear on the homepage.
7. Publish the Section entry. It appears on Dalelah between the car valuation strip and benefits strip; the surrounding search UI remains unchanged.

If Builder fails to show the preview iframe, check that the model Preview URL is the address above, the editor uses HTTPS, and that no additional content blocking extensions are in use.

## What is editable

- The new Builder section's layout, images, typography, spacing, copy, buttons, and backgrounds.
- Its desktop and mobile presentation within Builder's editor.

## What is NOT editable through this integration yet

- Search input/filters and vehicle results
- AI search orchestration
- Backend providers, inventory refresh, or source listings
- Existing header, navigation and SEO landing pages

Those stay in GitHub/Render. We can integrate more independently registered sections after validating the pilot.

## Security and reliability

- Only the Content **Public** API Key is used. Do not add a private Builder key.
- Only `/builder-preview` permits Builder editor iframe embedding. The normal site retains frame protections.
- The Builder visual section is isolated from Dalelah's search form.
- `/builder-preview` is marked noindex.
- Builder content requires a published entry to display. If no entry exists, the rest of the site continues to operate.
- Changes to Builder content generally do not require a GitHub deployment.

Builder docs: https://www.builder.io/c/docs/html-api and https://site.builder.io/c/docs/webcomponents-api
