# HANDOFF — 2026-11-20 — Slice 4, PR 3 (CI + CSP)

## Goal
Owner 2026-11-20: slice 4 in 3 PRs; PR 3 = GitHub Actions + CSP. No `VITE_API_BASE` work.

## State
- Open: #34 export/import (rank included), #35 PWA (install, share target, offline), PR 3 on `feat/ci-csp` (this work; commit/push/PR pending the full e2e run).
- Known main bug: `app.css` `.on-dark` repaint (qa2:171); the fix is the same hunk in #34, #35 and PR 3.
- PR 3: `ci.yml`, Kit `csp` in `vite.config.ts`, `vercel.json` headers, `csp.e2e.ts`, test fixes (time-bomb `checkedAt`, `<style>` injection, `fetch('data:')`), docs.
- Evidence: unit 303 PASS, check 0 errors, csp/health/qa/webgl/monitors/transitions e2e PASS; full run in progress.
- NOT proven: workflow on GitHub, live embeds under the CSP, vercel headers on a deploy.

## Next
Owner merges #34, #35, PR 3 (any order; app.css hunk identical). Then check the first CI run on main; final app icon; real-device checks (install, share target on Android, iOS share has no target).

## Risks / decisions
- `connect-src https:` and `style-src-attr 'unsafe-inline'` are deliberate wide spots (hls.js hosts, Svelte styles).
- Actions pinned by tag, not SHA (full SHAs unverifiable from the sandbox).
