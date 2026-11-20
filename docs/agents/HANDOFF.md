# HANDOFF — 2026-11-20 — TikTok title and cover (PR open)

## Goal
Owner's iPhone screenshots: a TikTok saved but showed a grey cover and the title "Vídeo do TikTok". Owner chose (2026-11-20): build the title from the @handle plus a drawn cover, no scraping, and upgrade already-saved generic titles (edited titles untouched).

## State (verified)
- Earlier: PR #25 (short link "could not check now", copy) merged as d81eb7a; `octa-api` redeployed from f456552 (live 2026-11-20 05:01 UTC).
- Implementation: done on branch `feat/tiktok-handle-title` (from main d81eb7a), web only. Merge: PR open, owner merges. Deploy: Vercel builds main after merge.
- Cause: TikTok's public oEmbed answers 200 without title, author or thumbnail (live endpoint and live API, 2026-11-20); the page has no og tags. Real covers/titles need scraping the page's internal JSON: not done.
- QA automated: `pnpm test` 274 PASS, `pnpm check` 0 errors, e2e 400 PASS / 19 skipped / 1 FAIL (`qa2.e2e.ts:299` Assistidos, flaky: 2 of 36 reruns fail on main too; passes alone). No CI workflow yet.
- NOT proven: iPhone; a recent TikTok with oEmbed metadata; a real `vt.` link expanding from Render.

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
