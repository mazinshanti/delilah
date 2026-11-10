# Dalelah visual-editing frontend (development only)

This folder is a **React/Vite component-based design workspace** for Builder Projects.
It is not the production frontend. It uses fixture vehicle cards, does not perform
marketplace scraping, does not call OpenAI, and cannot publish to `dalelah.co`.

## Builder Projects configuration

Choose the GitHub branch `feat/react-visual-editor-foundation-20261109`
and project root `visual-frontend` if Builder supports a root-folder field.

- Install command: `cd visual-frontend && npm install`
- Dev command: `cd visual-frontend && npm run dev`
- Preview URL: `http://localhost:3000/`

The visual editing project now has real React components, including Header, Hero,
SearchPanel, BenefitStrip, BrandGrid, Results, CarCard, and Footer.
These are **reusable source components**, not yet registered Builder Content blocks.
Visual manipulation depends on Builder Projects' editing support for the app.

## Release gates before replacing production

1. Port all existing UI behavior (Arabic/English, all filters, accessibility,
   car detail galleries, responsive layouts, dark mode).
2. Connect to existing Dalelah frontend API with a safe non-production proxy.
3. Validate exact make/model/year searches and AI routing, results and
   freshness verification. Do not use dummy vehicle fixtures in production.
4. Verify asset/SEO parity, mobile behavior, performance and accessibility.
5. Switch website frontend only after review of staged end-to-end results.

Never connect Builder's editing workspace to the live search backend or add
production secrets. Keep branch isolated from `main`.

## Draft design controls

This dev-only interface includes a right-to-left design toolbar:
- Reorder the hero, search, benefits, brand grid, and demo-results sections by dragging their blue section handles.
- Edit selected section headings and descriptions live.
- Change primary button and background colors.
- Automatically save the draft in **your own browser's local storage**.
- Download a JSON export of the design choices.

Changes here are NOT yet persisted to GitHub, Builder Content, or the production site; they are local browser drafts. JSON export is for manual review/hand-off. The production layout will only be replaced after a full React migration passes real search, source freshness, and mobile regressions.
