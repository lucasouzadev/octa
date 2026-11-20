# HANDOFF — 2026-11-20 — Slice 4, PR 2 (PWA)

## Goal
Owner 2026-11-20: slice 4 in 3 PRs (data, PWA, CI+CSP); SvelteKit service worker without a plugin; provisional icon; no `VITE_API_BASE` work.

## State (verified)
- main: #31, #32, #33. **Known bug on main**: `app.css` `.on-dark:not(dialog)` outranks the alert color (qa2:171 fails on main); fixed in PR #34 and repeated as the same hunk in PR 2.
- PR #34 `feat/export-import` (export/import JSON with rank): open. Branch `feat/pwa` (from main): manifest, provisional icons, `src/service-worker.ts`, `lib/share.ts` (+spec), `/add` prefill from url/text/title, `pwa.e2e.ts`, Playwright blocks service workers by default, Kit 3 config (`serviceWorker.register`, `paths.relative:false`), tsconfig exclude.
- `pnpm test` 309, `pnpm check` 0 errors, pwa e2e 42 PASS (2 reps × 3 viewports). Full e2e: 563 pass; failures only health:29 (fails on main), qa2:171 (css, fixed here), qa2:299 (flaky).
- NOT proven: install prompt / Add to Home Screen on real devices, share target on Android, Lighthouse PWA, SW update across two deploys. **iOS Safari has no Web Share Target** (caniuse): on iPhone the entry stays "Colar um link".

## Next step
Open PR for `feat/pwa`; then PR 3: GitHub Actions workflow (go test/vet/govulncheck + pnpm check/test/build + Playwright) and CSP (must allow the YouTube IFrame API script and `frame-src` youtube-nocookie/instagram/tiktok; verify against the running player before enforcing; ship as report-only first if unsure).

## Risks / owner decisions needed
- Final app icon (current is provisional).
- `src/service-worker.ts` is excluded from svelte-check (Kit requires it); it is not type-checked.
- Precache includes all build chunks (three/hls) — larger first install on cellular.
