# HANDOFF — 2026-11-22 — QA round 5, R5.2 part C (collection sort memory)

## Goal
Owner 2026-11-22: "salvar preferência de ordenação por tela na coleção". Approved: "Por coleção, no aparelho (Recomendado)".
Each collection remembers the video sort last chosen (Data / Título / Origem), device-only (localStorage `octa.vsort.<collectionId>`). Saved order behavior unchanged: the order is still written on the press.

## State
- PR #39 test debt: CI PASS. PR #40 (R5.1, R5.3-R5.6). PR #41 (R5.2 part A, CI PASS at 32cbcca).
- Branch `claude/r52-organize-drag` (part B, 3cddbff): drag handle for videos in a collection.
- Branch `claude/r52-collection-sort` (part C, stacked on part B): remembered sort chip (`aria-pressed`) per collection.
- No PR opened for part C (owner did not ask). Merge order (owner): #39, #40, #41, then part B, then part C. The agent never merges.

## Evidence
- Red first: qa5-sort e2e 2 failed (no `aria-pressed` on chip), 1 passed as regression guard; organize.spec 2 failed (no loadVideoSort/saveVideoSort).
- Green: vitest 353/353 PASS; svelte-check 0 errors PASS.
- e2e qa5-sort + qa5-drag + qa4-organize + organize: 72 passed (phone, tablet, desktop) PASS.
- Not run here: full e2e suite, CI for claude/r52-collection-sort (not pushed to CI watch yet).

## Next
1. Owner: decide if reopening a collection should auto-apply the remembered sort. Current: no (would fight manual drag order).
2. Physical test on iPhone/iPad: touch drag (part B) and remembered chip (part C).

## Risks / not proven
- Touch drag on real devices NOT RUN; R5.1/R5.5 only proven in code.
- Remembered sort is device-only: another device shows chip unpressed until chosen.
- Pending owner decisions: final icon, Render /healthz, home card "Continuar assistindo", "Correções da 2e-3" details.
- Flaky tests unchanged: enrich, transitions:46, monitors:104.
