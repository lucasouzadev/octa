# HANDOFF — 2026-11-19 — QA round 1 (R1.1–R1.8) in review

## Goal
Polish round from the owner's iPhone QA, one PR. Approved order: everything in one PR; docked bar via visualViewport; line-art b/w illustrations; remove empty cards in both cases.

## State (verified)
- main at the merge of PR #14 (2e-2 Collection screens). Branch `fix/qa-round-1`, PR open (not merged).
- IDs: R1.1/R1.2 docked input + Colar · R1.3 native sheet rule · R1.4 viewer fit + hearts + button order · R1.5 palette · R1.6/R1.6.1 "+" popover, empty states, back to top · R1.7 Assistir em sequência · R1.8 one color edge to edge.
- `pnpm check` 0/0, `pnpm test` 186 PASS, `pnpm build` PASS, `pnpm test:e2e` 224 PASS.
- NOT RUN: real iPhone (docked bar vs keyboard, Safari toolbar in the viewer, safe-area colors), CI (none yet).

## Decisions
- Docking is touch-only (`pointer: coarse`); mouse keeps the field in the page.
- Viewer has four actions by owner order: recorded as an exception to "≤ 3 actions" in DESIGN.md.
- Old e2e updated: label "Curtir", "+" menu replaces the dashed card, `fillField` helper blurs after typing (the docked bar covers the page button, as a keyboard would).

## Next step (exact)
Owner tests on iPhone (list in the PR) and merges. Then 2e-3: WebGL for the Collection monitors (real thickness, tilt by pointer/scroll).

## Risks / owner decisions
- Render limiter: one shared bucket until `CF-Connecting-IP` is proven per client from a phone on 4G. Health Check Path `/healthz` unset in Render.
- App icon open.
