# HANDOFF — 2026-11-19 — slice 2d-i (CSS-3D fan and stack) in review

## Goal
Slice 2 per `tasks/plan.md` (last section), order 2a → 2b → 2c → 2d; one PR per sub-slice, the owner merges. A video belongs to one collection only.

## State (verified)
- main at 519258d: 2a, 2b, 2c merged and tested by the owner.
- Branch `feat/slice-2d-css3d`, PR open (not merged): `lib/capability.ts` (+9 tests), `ui/FanStack.svelte` (Library cards, rotateY 16°, hover fan-out), `ui/PaperStack.svelte` (Collection, rotateX 14°). CSS only; no `three`/Threlte yet.
- `pnpm test` 126 PASS, `pnpm check` 0/0, `pnpm build` PASS, `pnpm test:e2e` 91 PASS + 2 skipped. JS gzip 53.4 → 54.3 KB.
- NOT RUN: physical checks, frame time (T14), CI.

## Decisions
- 2d is split: 2d-i CSS-3D floor (this PR), 2d-ii Threlte renderer behind the same props, lazy chunk, only when `canUseWebGL3D(readEnv())`.
- Verified versions for 2d-ii: @threlte/core 8.7.0, three 0.187.0, @types/three 0.187.0 (re-check the registry before installing).

## Next step (exact)
Owner merges and checks the fan and stack on the iPhone. Then 2d-ii: plan its budget (3D chunk size, main JS must not grow), add deps, `FanStack` WebGL renderer loaded on idle, dispose on destroy, measure frame time.

## Risks / owner decisions
- Render limiter: one shared bucket until `CF-Connecting-IP` is proven per client from a phone on 4G (see STATUS). Health Check Path `/healthz` still unset in the Render dashboard.
- iPhone Safari bottom bar covers the player strip (not fixed; offer a separate small fix).
- App icon open.
