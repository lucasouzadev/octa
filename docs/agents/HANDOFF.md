# HANDOFF — 2026-11-19 — slice 2e-1 (Library cards per the prototype) in review

## Goal
Slice 2 per `tasks/plan.md` (last section), order 2a → 2b → 2c → 2d; one PR per sub-slice, the owner merges. A video belongs to one collection only.

## State (verified)
- main at the merge of PR #11: WebGL fan merged and approved by the owner. Owner asked to continue 3D following `docs/design/prototype.pdf`.
- Branch `feat/slice-2e-library-cards`, PR open (not merged): `lib/fan.ts` (shared layout + content), CSS `FanStack`, WebGL `FanScene` redrawn per card face, Library card = name / fan / count, header "N coleções · M vídeos".
- `pnpm test` 146 PASS, `pnpm check` 0/0, `pnpm build` PASS, `pnpm test:e2e` 117 PASS + 6 skipped. Main JS +0.6 KB, 3D chunk 194.7 KB gzip.
- NOT RUN: real device look/GPU, CI.

## Decisions
- One layout function drives CSS and WebGL so they cannot drift.
- "Todos" stays first even though the prototype shows none (SPEC §4 says it always exists); asked in the PR.

## Next step (exact)
Owner merges and looks at the new cards on the iPhone. Then 2e-2: the Collection screen as a stack of tilted cream paper cards (prototype page 3), keeping Editar / Mover / Excluir and "Assistir em sequência".

## Risks / owner decisions
- Render limiter: one shared bucket until `CF-Connecting-IP` is proven per client from a phone on 4G (see STATUS). Health Check Path `/healthz` still unset in the Render dashboard.
- iPhone Safari bottom bar covers the player strip (not fixed; offer a separate small fix).
- App icon open.
