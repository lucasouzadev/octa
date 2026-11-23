# HANDOFF — 2026-11-23 — QA round 7 closed (owner iPhone screenshots)

## Goal
Owner QA round 7 on branch `claude/r52-collection-sort`. Order approved 2026-11-23: R7.1, R7.2, R7.3.

## State
- R7.1 Reordenar drag stall: DONE `6354d49`.
- R7.3a platform name shown once on the player screen: DONE `3ee355c`.
- R7.2 native player (platform's own controls, nothing of ours on top): DONE `6c161e4`.
- R7.3b per-platform theme (player + cards), heart morphs into platform icon and rises: DONE `db32fda`.
  - Owner override of the B/W rule recorded in `docs/design/DESIGN.md` (§1 and the line-74 exception).
  - `web/src/lib/platform.ts` maps source/kind to label, icon, colour.
- All four commits are pushed to `origin/claude/r52-collection-sort`.

## Repository state (checked 2026-11-23)
- PR #44 is MERGED and CLOSED. It merged at `f8f5a36` (round 6), BEFORE the four R7 commits.
- So R7.1/R7.2/R7.3a/R7.3b are NOT in `main` (`dacdd0f`). No open PR holds them. CI has not run on them (CI runs only on PRs to `main`).
- Branch is 4 ahead, 9 behind `origin/main`. `git merge-tree` shows a clean merge.
- Next step is the owner's: a new PR for these commits. The agent opens no PR unless asked.

## Evidence (at `db32fda`)
- svelte-check 0 errors. Vitest 365/365 PASS.
- e2e qa7-theme 15/15 PASS (phone/tablet/desktop); qa7-theme + qa7-title + cinema + sources + paste-to-player + qa3: 202 passed, 2 skipped.
- Go tests PASS at `6c161e4`; not re-run after.
- Full e2e NOT RUN. CI NOT RUN.

## Risks / not proven
- Physical, all NOT RUN: R6.1-R6.4, parts B/C, R7.1 drag on WebKit, R7.2 native fullscreen + YouTube params under sandbox, R7.3b theme and heart animation on iPhone Safari PWA, iPad, desktop.
- R7.1 root cause not proven on WebKit; Chromium never reproduced the stall.
- YouTube IFrame params (`controls`, `fs`, `playsinline`) known from memory, not re-read in the docs.
- The "Continuar de X" cover label is gone; resume still works (YouTube `start`, native `currentTime`, TikTok seek).
- `core.ts` helpers `clock`, `resumeLabel`, `staleEvent` are now unused by Cinema (dead code, not removed).
- Platform colours/icons are generic glyphs, no brand logos.
- Flaky tests: enrich, transitions:46, monitors:104, qa1:308, qa2:68.

## Open owner decisions (non-blocking)
- New PR for the four R7 commits (rebase/merge onto `main` first).
- Final icon, Render /healthz, home card "Continuar assistindo", "Correções da 2e-3".
