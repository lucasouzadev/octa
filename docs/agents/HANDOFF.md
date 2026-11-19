# HANDOFF — 2026-11-19 — slice 2d-ii (WebGL fan) in review

## Goal
Slice 2 per `tasks/plan.md` (last section), order 2a → 2b → 2c → 2d; one PR per sub-slice, the owner merges. A video belongs to one collection only.

## State (verified)
- main at 020f515: 2a–2d-i and the iOS findings fix (PR #10) merged.
- Branch `feat/slice-2d-threlte`, PR open (not merged): `ui/FanStack3D.svelte` + `ui/FanScene.svelte` (Threlte on-demand canvas, spring tilt, rounded alpha mask, soft shadow, dispose on destroy), `ui/active3d.svelte.ts` (one canvas at a time), `FanStack` loads the chunk on idle when `canUseWebGL3D`.
- `pnpm test` 135 PASS, `pnpm check` 0/0, `pnpm build` PASS, `pnpm test:e2e` 114 PASS + 6 skipped. Main JS +1.9 KB, 3D chunk 194 KB gzip.
- NOT RUN: real device GPU check, CI.

## Decisions
- WebGL only for the Library fan in this PR; the Collection paper stack stays CSS until the fan is judged on the iPhone.
- If the fan feels heavy on the phone, the gate in `capability.ts` is the single switch (e.g. raise the cores threshold) without touching components.

## Next step (exact)
Owner merges and judges the fan on the iPhone (smoothness while scrolling, battery, heat). Then decide: WebGL paper stack, or stop at this and go to slice 3 (Instagram, TikTok, HLS, health).

## Risks / owner decisions
- Render limiter: one shared bucket until `CF-Connecting-IP` is proven per client from a phone on 4G (see STATUS). Health Check Path `/healthz` still unset in the Render dashboard.
- iPhone Safari bottom bar covers the player strip (not fixed; offer a separate small fix).
- App icon open.
