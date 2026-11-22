# HANDOFF — 2026-11-22 — QA round 6 (owner iPhone screenshots)

## Goal
Owner QA round 6, four items. All built on branch `claude/r52-collection-sort` (PR #44 targets `main`).

## State
- R6.1 Organizar sheet orders Todos/Favoritos/Assistidos with the collections (`764e76d`): device-only slots in `octa.order.defaults`.
- R6.2 selection mode: a card tap selects, never opens the video (`a754f5a`).
- R6.3 "Mover para" shows every selected cover, smaller and fanned (`e11d703`).
- R6.4 delete-video screen in a collection: safe areas. Owner scoped it to "Apagar este vídeo?" in `/c/[id]`.
  - Root cause (proven by probe): the `rise` animation moved the whole orange `.danger` surface down 24px for 220ms, so the black page showed in the top safe area. html, body and meta theme-color were already orange.
  - Fix: the surface is static; only its content rises (`DangerScreen.svelte`). Also covers `/v/[id]`, which uses the same component.
  - Not done on purpose: recreating the `meta theme-color` (no evidence it was needed).
- Merge order (owner): #39, #40, #41, part B, #44. The agent never merges. Branch is behind `main`; expect conflicts.

## Evidence
- R6.4 red first: `qa6-danger.e2e.ts` "edge and corner" failed on phone, tablet, desktop; green after the fix (9/9).
- vitest 363/363 PASS; svelte-check 0 errors PASS.
- e2e qa5 + qa2 + qa3 + qa6-danger: 207 passed; `qa2.e2e.ts:68` failed under load, 3/3 PASS alone (known flake).
- CI for `764e76d` (run 45077689774): web and api succeeded; e2e verdict not confirmed at last check.

## Next
1. Watch CI for the R6.4 commit.
2. Physical test on iPhone Safari PWA, iPad, desktop: items R6.1 to R6.4, plus earlier parts B and C.

## Risks / not proven
- iPhone not run: R6.4 is proven in Chromium only; the 24px slide is a plausible cause of what the owner saw, not confirmed on device.
- Touch drag (part B) and remembered sort (part C) only proven in code.
- Open owner decisions: final icon, Render /healthz, home card "Continuar assistindo", "Correções da 2e-3".
- Flaky tests: enrich, transitions:46, monitors:104, qa1:308, qa2:68.
