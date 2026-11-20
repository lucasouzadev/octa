# HANDOFF — 2026-11-20 — TikTok short link feedback (PR open)

## Goal
Owner's iPhone screenshot: `vt.tiktok.com` link refused as "not supported". Approved 2026-11-20 by owner: diagnose read-only, then fix #2 (stale paste copy) + #3 (misleading error, longer timeout); read Vercel; redeploy `octa-api` from main.

## State (verified)
- Implementation: done — branch `fix/tiktok-short-link-feedback`, SHA a7521fe (from main f456552). Merge: PR open, owner merges. #24 (3e) already merged.
- Production API: `octa-api` redeployed from f456552, live 2026-11-20 05:01 UTC; canonical TikTok URL answers 200. Web production deploy is f456552. The new web fix is not deployed until merge.
- QA automated: `pnpm test` 266 PASS · `pnpm check` 0 errors · `pnpm test:e2e` 398 PASS / 19 skipped / 0 failed. No CI workflow exists yet (slice 4).
- NOT proven: a real `vt.`/`vm.` link expanding from Render (fake one answered 422); iPhone; YouTube/TikTok live.

## Decisions (and why)
- Failed expansion is `resolver_unavailable`, not `unsupported_url`: only an API 422 means the link is unsupported.
- Expansion timeout 20 s: Render free API wakes slowly.

## Files touched
- `web/src/lib/links.ts`, `providers/parse.ts`, `ui/EditVideoSheet.svelte`, `routes/add/+page.svelte` — error code, timeout, copy
- `links.spec.ts`, `paste-to-player.e2e.ts`, `sources.e2e.ts` — tests (red first); docs: `STATUS.md`, `PROVIDERS.md`

## Next step (exact)
Owner: merge the PR, then test on the production URL with the real `vt.` link on iPhone. If it still fails, read Render logs (`/v1/resolve`) and report the status.

## Risks / owner decisions needed
- `VITE_API_BASE` is set only for Vercel `production`: preview/branch builds call a relative `/api` and cannot reach the API. Decide: add it for Preview too (not done).
- Render free sleeps; first request after idle can be slow. TikTok may refuse the API's user-agent (unconfirmed).
- Then slice 4 (PWA install, share target, export/import, offline shell, CI workflow, CSP, E2E 3 viewports) and the owner's "correções da 2e-3" (details to come).
