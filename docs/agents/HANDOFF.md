# HANDOFF — 2026-11-19 — slice 2b (search) in review

## Goal
Slice 2 per `tasks/plan.md` (last section), order 2a → 2b → 2c → 2d; one PR per sub-slice, the owner merges. A video belongs to one collection only.

## State (verified)
- main at b553f60: slice 2a merged (PR #6), owner tested it in production on 2026-11-19.
- Branch `feat/slice-2b`, PR open (not merged): `web/src/lib/search.ts` (normalize + ranked search over title and author, all words must match, stable order) and the Library header search (lupa → field, "Cancelar", Escape, status line, empty state, results → `/v/<id>?c=todos`).
- `pnpm test` 113 PASS, `pnpm check` 0 errors, `pnpm build` PASS, `pnpm test:e2e` 66 PASS. JS gzip 51.6 → 52.8 KB.
- NOT RUN: physical iPhone/iPad/desktop of 2b; CI (no workflow, slice 4).

## Decisions
- Search covers the whole library, not one collection; the lupa is disabled while the library is empty.
- Ranking: word opens the title > opens any word > inside title > author only; ties keep newest first.
- Input is 16px so iOS Safari does not zoom on focus.

## Next step (exact)
Owner merges the 2b PR and tries search on the iPhone. Then plan details for 2c (View Transitions card → player, reduced-motion fade ≤120 ms, feature-detect) and start it, tests first.

## Risks / owner decisions
- Render limiter: one shared bucket until `CF-Connecting-IP` is proven per client from a phone on 4G (see STATUS). Health Check Path `/healthz` still unset in the Render dashboard.
- iPhone Safari bottom bar covers the player strip (not fixed; offer a separate small fix).
- App icon open.
