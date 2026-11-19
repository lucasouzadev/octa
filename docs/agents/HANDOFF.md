# HANDOFF — 2026-11-19 — slice 1 (paste → resolve → card → player)

## Goal
First vertical slice — approved 2026-11-19 by owner ("pode dar início ao projeto"): YouTube long/Shorts + direct .mp4, Go `/v1/resolve`, PWA paste/library/player. Plan: `tasks/plan.md`.

## State (verified, with evidence)
- Implementation: done on branch `feat/slice-1` (commits 97f1d69, f3f14d0, 651f6ce + docs commit).
- Merge: PR open against `main`, **not merged** (owner reviews).
- Production: none — no deploy target chosen.
- QA automated: API `go test -race ./...` PASS, `go vet` PASS, govulncheck clean; web `pnpm test` 73 PASS, `pnpm check` 0 errors, `pnpm build` PASS, `pnpm test:e2e` 24 PASS (390/834/1440). CI: N/A — no workflow until slice 4.
- QA physical: pending — owner on iPhone Safari, iPad, desktop (see PR test list).

## Decisions (and why)
- Client parser owns identity (canonical URL, embed src); API only adds title/author/thumb/health → a bad API response cannot redirect the player.
- Upstream failure returns 200 + `health: unknown` (doc updated) so links still save offline/API-down.
- SSRF guard checks the dialed IP (covers redirects/DNS rebinding); no HTTP proxy in the fetch client.
- SvelteKit 3 + TypeScript 6 (scaffold default); `#lib/*.ts` subpath imports.

## Files touched
- `api/**` — Go module (provider, fetch, cache, resolve, httpapi, cmd/api).
- `web/**` — SvelteKit app, routes `/`, `/add`, `/v/[id]`, tests.
- `testdata/urls.json` — shared parser vectors.
- `docs/architecture/ARCHITECTURE.md`, `docs/STATUS.md`, `tasks/plan.md`.

## Next step (exact, first action)
Boot; check the PR state with GitHub tools; if merged, plan slice 2 (collections, Threlte fan/stack + CSS fallback, search, View Transitions) and ask for "yes".

## Risks / blocked / owner decisions needed
- Gaps listed in `docs/STATUS.md` (skeleton, client IP behind proxy, no CI, double-paste race).
- Owner: app icon; hosting before slice 4.
