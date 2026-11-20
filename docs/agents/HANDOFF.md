# HANDOFF — 2026-11-20 — TikTok title and cover (PR open)

## Goal
Owner's iPhone screenshots: a TikTok saved but showed a grey cover and the title "Vídeo do TikTok". Owner chose (2026-11-20): build the title from the @handle plus a drawn cover, no scraping, and upgrade already-saved generic titles (edited titles untouched).

## State (verified)
- Implementation: done — branch `fix/qa-round-3`, 13 commits from main d81eb7a (R3.1+R3.3 share one commit). Merge: PR open, owner merges. PR #26 (TikTok handle title) is still open and separate.
- Automated: `pnpm test` 274 PASS · `pnpm check` 0 errors · full e2e 501 PASS / 9 failed / 12 skipped (522). The 9: `health.e2e.ts:29` x3 viewports fails the same on origin/main (pre-existing); 6 were my tests assuming the phone viewport, fixed and re-run green on 3 viewports (no second full run).
- NOT proven: any iPhone behavior (rubber band and arrow z-order R3.1, keyboard white areas R3.6, 3D, real fullscreen R3.13). No CI workflow exists yet (slice 4).

## Decisions (and why)
- Handle title from the canonical URL, API generic title never overwrites it, a real API title wins.
- Drawn cover = the author text on the card/fan tile when there is no thumbnail (any source).

## Files touched
- `web/src/lib/links.ts` (tiktokHandle, upgradeGenericTitles, metaPatch guard), `fan.ts`, `ui/ScreenCard.svelte`, `ui/FanStack.svelte`, `routes/+page.svelte`
- tests: `lib/tiktok-meta.spec.ts`, `routes/sources.e2e.ts`; docs: `STATUS.md`, `PROVIDERS.md`

## Next step (exact)
Owner merges the PR, opens the production URL on iPhone (home runs the upgrade), checks title and cover. Then slice 4 (PWA install, share target, export/import, offline shell, CI workflow, CSP, E2E 3 viewports) and the owner's "correções da 2e-3".

## Risks / owner decisions needed
- `VITE_API_BASE` is set only for Vercel `production`; preview builds cannot reach the API (not changed).
- Flaky `qa2.e2e.ts:299` (XS fix, separate PR if wanted): wait for the UI to confirm the mark before `page.goto('/')`.
- Floating "Assistir em sequência" button covers part of the second card's title while scrolling (low, seen in screenshot, not touched).
