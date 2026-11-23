# HANDOFF — 2026-11-23 — QA round 7 (owner iPhone screenshots)

## Goal
Owner QA round 7, three items, on branch `claude/r52-collection-sort` (PR #44 targets `main`).
Owner approved triage and order on 2026-11-23: R7.1, R7.2, R7.3. Test first, one commit per logical change.

## State
- R7.1 Reordenar drag stalls mid-way: DONE `6354d49`. Rows keep their DOM place while dragging; others slide by transform.
- R7.3a platform name shown once on the player screen: DONE `3ee355c`.
- R7.2 native player ("Nativo híbrido", approved): DONE (commit after 3ee355c). Evidence: svelte-check 0, vitest 363, Go PASS, e2e cinema/resume/paste/health/sources/qa3 PASS on 3 projects. YouTube params + fullscreen under sandbox UNVERIFIED on iPhone.
  - Remove our cover, big play and custom bar. YouTube: its own controls and fullscreen. TikTok/Instagram: pure embed. `<video controls>`.
  - Keep resume ("Continuar assistindo") and "assistido" through the platform API where it exists.
  - Consequence for the owner: the "Continuar de X" label on the cover goes away; resume still happens (YouTube `start`, native `currentTime`, TikTok seek).
  - TikTok embed loses the hide-chrome params (Go `social.go`, web `parse.ts`, specs, docs change together).
- R7.3b per-platform theme (player + library cards) and heart that morphs into the platform icon and rises: NOT STARTED, approved scope "Player + cartões".
  - Conflict to report: per-platform colour/logo vs "black/white by default, colour only on action screens" (`docs/design/DESIGN.md`) and the approved visual direction of 2026-11-19. Owner's current instruction wins; keep simple icons, no brand impersonation.
- Merge order (owner): #39, #40, #41, part B, #44. The agent never merges.

## Evidence
- R7.1 red first, then green (`qa7-drag.e2e.ts`). Root cause NOT proven on WebKit; Chromium could not reproduce the stall.
- svelte-check 0 errors; e2e qa7-drag + organize + qa4/qa5: 81 passed; qa7-title + cinema + paste-to-player + sources: 91 passed, 2 skipped.
- Full vitest and full e2e NOT RUN in this round.

## Next
1. R7.2 tests red, then Cinema + adapters, then docs (DESIGN, STATUS, ADR-0004, PROVIDERS).
2. R7.3b tests red, then theme + heart morph.
3. Push, watch CI, physical test list.

## Risks / not proven
- YouTube IFrame params (`controls`, `fs`, `playsinline`) known from memory, not re-read in the docs this round.
- iPhone not run: R6.1-R6.4, R7.1 (drag), R7.2 (native fullscreen) need a physical test.
- Open owner decisions: final icon, Render /healthz, home card "Continuar assistindo", "Correções da 2e-3".
- Flaky tests: enrich, transitions:46, monitors:104, qa1:308, qa2:68.
