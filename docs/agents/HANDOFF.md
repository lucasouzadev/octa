# HANDOFF — 2026-11-19 — slice 2e-2 (Collection screens in 3D) in review

## Goal
Slice 2 per `tasks/plan.md` (last section), order 2a → 2b → 2c → 2d; one PR per sub-slice, the owner merges. A video belongs to one collection only.

## State (verified)
- main at the merge of PR #12 (Library cards per the prototype, owner approved).
- Branch `feat/slice-2e2-collection-screens`, PR open (not merged): Collection screen = pile of tilted 3D screens ("como monitores", owner's words) — `lib/shelf.ts` (pose, duration, status, summary) + `ui/ScreenCard.svelte`; PaperStack removed; header "N vídeos · K fora do ar"; editing flattens the pile.
- `pnpm test` 157 PASS, `pnpm check` 0/0, `pnpm build` PASS, `pnpm test:e2e` all PASS. Main JS 57.7 KB gzip.
- NOT RUN: real device look, CI. WebGL for these screens is 2e-3.

## Decisions
- Author is not printed on a screen (prototype shows source and length only); open to the owner in the PR.
- Unknown health prints no status; only links known dead are counted in the header.

## Next step (exact)
Owner merges and looks at the screens on iPhone/iPad. Then 2e-3: WebGL for the pile behind `canUseWebGL3D`, one canvas at a time, same pose from `screenTilt`, with a real bezel thickness (box geometry) and pointer/scroll tilt.

## Risks / owner decisions
- Render limiter: one shared bucket until `CF-Connecting-IP` is proven per client from a phone on 4G (see STATUS). Health Check Path `/healthz` still unset in the Render dashboard.
- iPhone Safari bottom bar covers the player strip (not fixed; offer a separate small fix).
- App icon open.
