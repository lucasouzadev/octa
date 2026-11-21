# HANDOFF — 2026-11-21 — QA round 4

## Goal
Owner 2026-11-21: analyze two iPhone recordings, review code, add e2e. Approved: PR A (main CI) + PR B (round 4, tests first). Organizar: reorder videos in a collection, sort, move several. Top fade: on-device experiment. Delete: Desfazer 6 s.

## State (verified against GitHub 2026-11-21)
- #1–#36 merged. PR #37 (`fix/restore-pwa-config`): restores `serviceWorker.register` + `paths.relative=false`, two e2e race fixes (qa2 Assistidos, qa1 popover), STATUS, QA-ROUND-4. CI green (run 44885258605). Not merged: owner merges.
- PR B (`fix/qa-round-4`, based on `fix/restore-pwa-config`): R4.1 R4.2 R4.3 R4.4 R4.5 R4.7 + R4.6 experiment (own commit 7ac69fe-equivalent, revert alone). Evidence in docs/qa/QA-ROUND-4.md "Status after the fixes".
- Not done: R4.8 grey covers on cold open, R4.9 double exposure in transitions.

## Next
1. Owner merges #37, then PR B (retargets to main). 2. Owner tests on iPhone: R4.1 cold start, R4.2 feel, R4.3 no prompt on random tap, R4.4 centered, R4.5 organize, R4.6 top bar, R4.7 Desfazer.

## Risks / not proven
- R4.6 cause is a hypothesis (missing status-bar style); the strip only exists in installed mode.
- Fragile fixtures still use fixed dates in `stacks`/`sources`; timing tests listed in QA-ROUND-4 "Test debt".
- Pending owner decisions: final icon, Render /healthz, home card "Continuar assistindo".
