# HANDOFF — 2026-11-19 — slice 2c (View Transitions) in review

## Goal
Slice 2 per `tasks/plan.md` (last section), order 2a → 2b → 2c → 2d; one PR per sub-slice, the owner merges. A video belongs to one collection only.

## State (verified)
- main at 1b972fd: 2a and 2b merged (owner approved search 2026-11-19).
- Branch `feat/slice-2c`, PR open (not merged): `onNavigate` in the root layout (`lib/transition.ts` decides none/fade/full); list rows (Collection, search results) name their thumbnail on tap so it morphs into the player frame; colors cross-fade; reduced motion = 100 ms fade, no morph.
- `pnpm test` 117 PASS, `pnpm check` 0 errors, `pnpm build` PASS, `pnpm test:e2e` 78 PASS. JS gzip 52.8 → 53.4 KB.
- NOT RUN: seeing it on iPhone Safari; CI (slice 4).

## Decisions
- Library cards open a Collection screen, not the player, so only list rows morph; cards just cross-fade.
- The shared name is set on tap and cleared when the transition ends (only one element may hold it).

## Next step (exact)
Owner merges the 2c PR and feels it on the iPhone. Then plan and start 2d (capability detection, CSS-3D fan/stack first, then Threlte lazy-loaded), tests first.

## Risks / owner decisions
- Render limiter: one shared bucket until `CF-Connecting-IP` is proven per client from a phone on 4G (see STATUS). Health Check Path `/healthz` still unset in the Render dashboard.
- iPhone Safari bottom bar covers the player strip (not fixed; offer a separate small fix).
- App icon open.
