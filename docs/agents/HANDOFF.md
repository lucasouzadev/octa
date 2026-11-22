# HANDOFF — 2026-11-22 — QA round 5, R5.2 part A

## Goal
Owner 2026-11-22: six iPhone findings (R5.1-R5.6). Approved: batches A+B, then R5.2 option B (Organizar in 2 pages, sort per screen, move, drag by handle), 2 PRs.

## State
- PR #40 `claude/qa-round-5` (R5.1, R5.3-R5.6 + test updates f9fbc0e): CI of f9fbc0e pending; run 44980512464 (old head) failed on 2 stale tests, fixed.
- PR #41 `claude/r52-organize-pages` (base main; CI only runs on PRs to main; includes #40 commits, merge #40 first): sheet in 2 pages Organizar | Dados, sort saved per screen. CI watcher running.
- PR #39 (test debt): CI PASS.
- Owner merges; the agent never merges.

## Evidence (6225be2 + merge 4274f88)
- vitest 351/351 PASS; svelte-check 0 errors PASS.
- Targeted e2e (backup, organize-pages, qa4, tilt, qa5, organize), 3 viewports: 154 passed, 14 skipped PASS.
- Full e2e NOT RUN locally (CI). Physical NOT RUN.

## Next
1. R5.2 part B (separate PR, tests first; `routes/+page.svelte` is a hotspot): sort date/name/manual on home and collections (per-screen preference), move items, drag by reorder handle (pointer events). Check how the R4.5 collection "Editar" mode relates first.
2. Report `CI: <state> <url>` for #40 and #41.
3. Update `docs/qa/QA-ROUND-5.md` and `docs/STATUS.md` for R5.2 when done.

## Risks / not proven
- R5.3 "+ menu asks" not reproduced; R5.1/R5.5 proven in code, not on device.
- Pending owner decisions: final icon, Render /healthz, home card "Continuar assistindo", "Correções da 2e-3" details.
- Flaky tests unchanged: enrich, transitions:46, monitors:104.
