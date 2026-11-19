# HANDOFF — 2026-11-19 — QA round 2 (R2.1–R2.7) in review

## Goal
Second iPhone QA round, one PR (`fix/qa-round-2`): menu from the button, no zoom/selection, docked bar on visualViewport, orange delete screens, redrawn illustrations, edit, Assistidos, Favoritos, inline rename.

## State (verified)
- R1 (PR #15) merged. Branch `fix/qa-round-2`, PR open (not merged).
- `pnpm check` 0/0, `pnpm test` 204 PASS, `pnpm build` PASS, `pnpm test:e2e` PASS at 3 viewports.
- NOT RUN: real iPhone (docked bar, viewer fit, safe areas), CI (none).

## Decisions
- Zoom and selection blocked (owner choice; a11y tradeoff recorded). Watched = manual + auto on native end. Favoritos 3D is minimal for now.

## Next step (exact)
Owner tests on iPhone and merges. If the docked bar still fails, open `?kbdebug` and send a screenshot. Then 2e-3: WebGL for the Collection monitors.

## Risks / owner decisions
- Render limiter shared bucket; `/healthz` unset; app icon open; real dead-link health check is slice 3.
