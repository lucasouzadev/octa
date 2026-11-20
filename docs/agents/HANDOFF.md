# HANDOFF — 2026-11-20 — QA round 3 (PR open)

## Goal
Owner's iPhone QA, 13 items (R3.1–R3.13). Approved 2026-11-20: one branch `fix/qa-round-3`, one PR, commit per item; #13 = center and enlarge; #3 = new matte green `#2F6B4F`.

## State (verified)
- Implementation: done — branch `fix/qa-round-3`, 13 commits from main d81eb7a (R3.1+R3.3 share one commit). Merge: PR open, owner merges. PR #26 (TikTok handle title) is still open and separate.
- Automated: `pnpm test` 274 PASS · `pnpm check` 0 errors · full e2e 501 PASS / 9 failed / 12 skipped (522). The 9: `health.e2e.ts:29` x3 viewports fails the same on origin/main (pre-existing); 6 were my tests assuming the phone viewport, fixed and re-run green on 3 viewports (no second full run).
- NOT proven: any iPhone behavior (rubber band and arrow z-order R3.1, keyboard white areas R3.6, 3D, real fullscreen R3.13). No CI workflow exists yet (slice 4).

## Decisions (and why)
- Docked input removed; plain fields again (owner order). Favoritos = `action.favorite`; hearts black/white. Toast lives in the layout so it survives navigation. Sheet `crown` straddles the top edge; transform moved from `.panel` to `.rise`.

## Next step (exact)
Owner: test the PR preview on iPhone with the AUTOMATED/PHYSICAL list in the PR, then merge. Then: `VITE_API_BASE` for Vercel Preview (decision pending), flaky `health.e2e.ts:29` and `qa2.e2e.ts:299`, slice 4, "Correções da 2e-3".

## Risks / owner decisions needed
- iOS may still show the rubber band at the end of the collection (`overscroll-behavior` support varies); if so, next step is a JS guard.
- Preview builds call a relative `/api` (no `VITE_API_BASE` for Preview).
