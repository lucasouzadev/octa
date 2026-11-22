# HANDOFF — 2026-11-21 — test debt

## Goal
Owner (Juice) chose "Test debt" after slice 4 was found already on main. Scope: remove fixed fixture dates; stabilise flakes listed in STATUS.

## State (verified 2026-11-21)
- Slice 4 on main: #34 export/import, #35 PWA, #36 CI+CSP, #37/#38 QA round 4. Main CI green at e3904f2 (run 44898993651).
- PR #24 (slice 3e) merged 2026-11-19.
- Branch `claude/ecstatic-fermat-61ytp7` @ 3f9b709, pushed, NO PR. Replaces fixed `checkedAt` 2026-11-19 in web/src/routes/stacks.e2e.ts and sources.e2e.ts with `new Date().toISOString()`.
- Evidence: vitest 350/350; pnpm check 0 errors; playwright stacks+sources 47 passed / 4 skipped (before and after); enrich+transitions+monitors 33 passed.
- Local browser: project Playwright 1.65.1 wants chromium 1255 (absent); ran via scratchpad wrapper config using /opt/pw-browsers/chromium-1243. Repo unchanged.
- This handoff file is written locally only. Its commit and push were denied by the auto-mode classifier; not committed.

## Next
1. Owner decides whether to open a PR for 3f9b709. CI workflow runs only on PR and push to main, so the feature branch has no CI run until a PR exists.
2. Owner decisions pending: final app icon; Render Health Check Path /healthz; home card "Continuar assistindo".
3. Flakes enrich.e2e, transitions.e2e:46, monitors.e2e:104: NOT changed. Need a reproduction under load before any change.

## Risks / NOT proven
- Fixed-date fixtures were a latent bug: no red reproduced, so no TDD red step.
- Fixed-date unit specs (health.spec, enrich.spec) use deliberate times; left as is.
- Full E2E suite (392) not run in this change; only touched and flaky-listed specs.
- Physical checks (iPhone Safari PWA, iPad, desktop): NOT RUN.
