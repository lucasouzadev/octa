# HANDOFF — 2026-11-20 — Slice 4, PR 1 (export/import)

## Goal
Owner 2026-11-20: do slice 4 (PWA install, share target, export/import carrying `rank`; skip `VITE_API_BASE`). Approved: 3 PRs (1 data, 2 PWA, 3 CI+CSP); SvelteKit `service-worker.ts` without @vite-pwa; provisional black/white icon; export/import buttons in the Organizar sheet; duplicate = existing wins.

## State (verified)
- main has #31, #32, #33 (toast, tilt, organize, QA 3).
- Branch `feat/export-import` (from main): `lib/backup.ts` (+spec), `lib/backup-io.ts`, `Library.exportAll/importBackup`, OrganizeSheet rows, Organizar visible on empty Library, `backup.e2e.ts`. `pnpm test` 320, `pnpm check` 0 errors. Full e2e: see PR.
- NOT proven: iOS share/Files on a real iPhone.

## Next step
Open the PR for `feat/export-import`; then PR 2 (manifest, `src/service-worker.ts`, `/share` target route, icons, offline shell tests), then PR 3 (GitHub Actions: go test/vet + pnpm check/test/build + Playwright; CSP per ARCHITECTURE §6).

## Risks / owner decisions needed
- Share target needs HTTPS + an installed PWA; cannot be proven headless.
- CSP must allow the YouTube IFrame API script (`www.youtube.com/iframe_api`, `s.ytimg.com`) used by the player: verify before enforcing.
- Pre-existing flaky: `health.e2e.ts:29` (fails on main), `health.e2e.ts:17`, `enrich.e2e.ts` under load.
