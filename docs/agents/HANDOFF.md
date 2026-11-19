# HANDOFF — 2026-11-19 — slice 2e-3 (WebGL monitors) in review

## Goal
Close the main plan in order 2e-3 -> 3 -> 4 (owner choice). 2e-3: WebGL monitors on the Collection screen, one fixed canvas.

## State (verified)
- R2 (PR #16) merged. Branch `feat/slice-2e3-webgl-monitors`, PR open (not merged).
- `pnpm check` 0/0, `pnpm test` 213 PASS, `pnpm build` PASS, `pnpm test:e2e` PASS at 3 viewports.
- NOT RUN: real iPhone/iPad GPU, CI (none).

## Decisions
- One canvas over the pile; faces painted from the DOM row; CSS monitors stay as fallback and for editing.

## Next step (exact)
Owner tests 2e-3 on iPhone and merges. Then slice 3 (Instagram, TikTok, HLS, /v1/health, real dead-link check, Continuar assistindo), then slice 4 (PWA install, share target, export/import, offline shell, CI).

## Risks / owner decisions
- Row-to-player morph starts from a transparent row with WebGL on. Render limiter shared bucket; `/healthz` unset; app icon open.
