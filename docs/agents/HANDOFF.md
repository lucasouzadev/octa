# HANDOFF — 2026-11-21 — QA round 4

## Goal
Owner 2026-11-21: analyze two iPhone recordings, review code, add an e2e. Approved plan (AskUserQuestion): PR A (main CI fix) + PR B (round 4, tests first). Organizar: reorder videos in a collection, sort videos, move several at once. Top fade: on-device experiment. Delete: Undo for 6 s.

## State (verified against GitHub 2026-11-21)
- All PRs #1–#36 merged (owner merged #34, #35, #36 on 2026-11-20 22:45–22:47 UTC).
- Main CI red after #36: `pwa.e2e.ts:47` (R7 offline shell, 3 viewports). Cause: merge resolution dropped `serviceWorker.register` and `paths.relative:false` from `vite.config.ts`.
- PR A (`fix/restore-pwa-config`): restores the two lines, STATUS update, `docs/qa/QA-ROUND-4.md`. Local evidence: pwa+csp e2e 36 passed, unit 326, check 0 errors, full e2e 598 passed / 5 timing failures (transitions:46, monitors:104, qa1:337, qa3:137, qa2:68).
- Findings R4.1–R4.9 with evidence: `docs/qa/QA-ROUND-4.md`.

## Next
1. Open PR A, watch CI. 2. PR B from main: `qa4.e2e.ts` red first, then R4.4, R4.3, R4.2; R4.1, R4.7, R4.6; R4.5.

## Risks / not proven
- iPhone-only effects (R4.6 top fade, cold start timing) are inferred from video.
- Timing-fragile e2e (see QA-ROUND-4 "Test debt") can redden CI; one retry is configured.
