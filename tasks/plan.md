# Implementation Plan: slice 1 — paste → resolve → card → player

Approved by owner 2026-11-19 ("pode dar início ao projeto"). Branch `feat/slice-1`. Spec: `docs/product/SPEC.md` §8.1.

## Overview
First vertical slice: a user pastes a YouTube (long/Shorts) or direct `.mp4` link, the Go API resolves it, the PWA stores it in IndexedDB, lists it and plays it. Instagram, TikTok, HLS, health checks, collections and 3D are later slices.

## Architecture decisions
- Shared URL test vectors in `testdata/urls.json`, read by Go tests and Vitest — one truth for both parsers.
- Go stdlib only, plus `golang.org/x/time/rate`. `go 1.27` with `toolchain go1.27.4`.
- SSRF guard in `internal/fetch`: validate the *dialed* IP in a custom `net.Dialer.Control`, so redirects and DNS rebinding are covered.
- Web keeps working when the API fails: the client parser builds the item; metadata fills in later.
- Tests that touch the network use `httptest` servers; the SSRF guard has an opt-in allow for loopback **only in tests**.

## Task list
### Phase 1 — API
- [x] T1 Shared vectors `testdata/urls.json` (YouTube watch/short/youtu.be/live/embed/m./start, direct mp4/webm, unsupported, invalid)
- [x] T2 `internal/provider`: Parse for YouTube + direct, table tests over vectors
- [x] T3 `internal/fetch`: safe client (scheme, IP ranges on dial, ≤3 redirects, 5 s, 1 MB) + tests
- [x] T4 Resolve: YouTube oEmbed + thumbnail fallback; direct HEAD content-type; TTL cache
- [x] T5 `internal/httpapi`: `POST /v1/resolve`, `GET /healthz`, CORS from env, per-IP rate limit, body cap; `cmd/api/main.go`
### Checkpoint A: `go test ./... && go vet ./...` PASS
### Phase 2 — Web
- [x] T6 Scaffold SvelteKit 3 + adapter-static + Vitest + Playwright (pnpm); `tokens.css` from `docs/design/tokens.json`
- [x] T7 Client parser over the same vectors; IndexedDB repo (`idb`, tested with `fake-indexeddb`)
- [x] T8 Routes: `/add` (blue Paste screen), `/` (minimal library list), `/v/[id]` (player: YouTube nocookie iframe / native video, 3 pill actions)
- [x] T9 Playwright smoke at 390/834/1440 with the API mocked by route interception
### Checkpoint B: `pnpm check && pnpm test && pnpm build && pnpm test:e2e` PASS
- [x] T10 Review, PR, handoff

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| YouTube oEmbed unreachable from sandbox | Med | Resolve tested with httptest; parser fallback covers UI |
| TypeScript 7 / Vite 8 tooling gaps | Med | Use `sv create` defaults; pin what works, note deviations |
| Playwright browsers not installable here | Low | Report BLOCKED with reason, keep the spec for CI (slice 4) |

## Out of scope
Instagram/TikTok/HLS, `/v1/health`, collections, Threlte, View Transitions, service worker, deploy, CI workflow.

---

# Plan: host the API on Render (free)

Owner approved steps 1–2 on 2026-11-19; steps 3–5 each need a fresh "yes" (deploys always ask).

1. [x] Test first + `CLIENT_IP_HEADER` (`httpapi.Config.ClientIPHeader`): single valid IP from a trusted header, else RemoteAddr; empty = ignore all headers. Do NOT use `X-Forwarded-For` on Render (it appends, so the first entry is forgeable and the last is the shared edge IP).
2. [x] `api/Dockerfile` (golang:1.27.4-alpine -> distroless static-debian13:nonroot) + `.dockerignore`. Tags verified with `docker manifest inspect`. Image build NOT RUN (no Docker daemon in the agent sandbox); the same `go build` flags were run natively.
3. [ ] Render free web service: Docker, root dir `api`, health check `/healthz`, env `ALLOWED_ORIGINS=https://web-chi-nine-h1xmk9enwg.vercel.app`, `CLIENT_IP_HEADER=True-Client-IP`. (needs "yes")
4. [ ] Vercel env `VITE_API_BASE=<render url>` then redeploy. (needs "yes")
5. [ ] Smoke: `curl <render>/healthz`; 12 requests with forged `True-Client-IP` values must hit 429 only if the header is NOT overwritten by the edge (if never 429, the header is forgeable: switch strategy); paste a real YouTube link in the app.

Risks: `True-Client-IP` behaviour on Render comes from community/support posts, not official docs -> step 5 decides. Free instance cold start ~50 s+ and 750 free hours/month are shared with the existing `Hotel-Flor-de-Lima` service. Vercel preview URLs are not in the CORS allowlist (production only).

---

# Plan: slice 2 — Library, collections, search, View Transitions, 3D thumbs

Status: APPROVED by owner 2026-11-19 (order 2a → 2b → 2c → 2d; one collection per video). Branch `feat/slice-2a` first.
Spec: `docs/product/SPEC.md` §4 flows 3, 4, 7 and §8 slice 2; design: `docs/design/DESIGN.md` §5–7; ADR-0003.
Branch per sub-slice, one PR each; the owner merges.

## Overview
Turn the flat list into the real Library: collections as cards, a black Collection screen, search, a card→player View Transition, and 3D (fan + paper stack) as an enhancement over a CSS-3D fallback that ships first.
2D first, 3D last: the fallback is mandatory anyway (ADR-0003), so 2a–2c are demoable on their own and the risky part (WebGL) comes with a working floor.

## Architecture decisions
- IndexedDB `octa` v1 → v2: add `collections` store `{ id, name, order: string[], createdAt, updatedAt }`. The v1 upgrade must keep every video (migration test opens a real v1 DB, upgrades, asserts videos intact).
- "Todos" is virtual: all videos, newest first, always present, cannot be renamed or deleted. User collections hold ordered video ids. A video belongs to at most one user collection (spec says "move item"); it always also shows in Todos. (Owner decision Q1.)
- Search is client-side over title + author, accent- and case-insensitive (pt-BR), no API call.
- View Transitions via SvelteKit `onNavigate` + `document.startViewTransition`, shared `view-transition-name` on the thumbnail → video frame. Unsupported browser or `prefers-reduced-motion`: no transition / ≤120 ms fade (A6).
- 3D: Threlte scene per component (`FanStack`, `PaperStack`), dynamically imported, only when capable. Capable = WebGL available AND not reduced-motion AND not Save-Data AND not low-end (`hardwareConcurrency` ≤ 4 or `deviceMemory` ≤ 4). Otherwise the same component renders CSS-3D. One interface, two renderers.
- Pinned dependencies (verified on the npm registry 2026-11-19; peers `three >=0.172`, `svelte >=5` satisfied): `@threlte/core` 8.7.0, `three` 0.187.0, `@types/three` 0.187.0. `@threlte/extras` 9.23.1 only if a task needs it. Exact versions, lockfile committed, `pnpm audit` before the PR.
- Textures: `i.ytimg.com` thumbnails send `access-control-allow-origin: *` (checked with curl), so `crossOrigin="anonymous"` textures work. Direct `.mp4` has no thumbnail → flat paper placeholder with the title. No image proxy (invariant: API serves no bytes).

## Task list
### Phase 2a — Collections (2D, no 3D)
- [x] T1 Test first: v1→v2 migration keeps videos; collection CRUD (create, rename, delete, move item, reorder) invariants (one collection per video, delete collection keeps videos, order has no ghost ids).
- [x] T2 `Library` API: collections store + methods; handle the double-paste unique-index race (known gap): return the existing item instead of throwing.
- [x] T3 Library screen (white): collection cards (name, count, 2D thumb mosaic), "Todos" first, skeleton while IndexedDB loads (known gap), empty state. Header: search + add only (≤3 actions).
- [x] T4 Collection screen `/c/[id]` (black): video list, one primary action "Assistir em sequência"; back. Player: next follows the collection order.
- [x] T5 Manage: create collection (blue action screen, one field), rename, delete, move item (sheet). Copy in pt-BR.
- [x] T6 e2e at 390/834/1440: create → move → open → play in sequence → reload persists (A4, A5).
### Checkpoint 2a: `pnpm check && pnpm test && pnpm build && pnpm test:e2e` PASS (2026-11-19: 0 errors, 99 unit, 48 e2e); physical demo on the owner's iPhone pending.

### Phase 2b — Search
- [x] T7 Test first: normalize + rank (accents, case, author match, empty query = all).
- [x] T8 Search UI in Library header; results across all collections, tap → player; empty-result state; keyboard and a11y labels.
### Checkpoint 2b: same commands PASS.

### Phase 2c — View Transitions
- [x] T9 `onNavigate` transition: thumbnail → video frame (380 ms, `cubic-bezier(.2,.8,.2,1)`), screen color cross-fade 320 ms (white → black). Reduced motion ≤120 ms fade. Feature-detected.
- [x] T10 e2e: reduced-motion emulation asserts no long animation; unsupported path still navigates.
### Checkpoint 2c: PASS; physical check on iPhone Safari (version support noted).

### Phase 2d — 3D thumbs (enhancement)
- [x] T11 `capability.ts` (+ unit tests for each gate: no WebGL, reduced motion, Save-Data, low-end).
- [x] T12 `FanStack`/`PaperStack` CSS-3D renderers first (the floor): fan tilt 16°, stack rotateX 14° (DESIGN §6). e2e screenshots at 3 viewports, read before claiming done.
- [ ] T13 Threlte renderers behind the same props, lazy chunk loaded on idle; spring tilt (stiffness ~0.15, damping ~0.8); dispose textures/geometry on destroy (no leak on navigation).
- [ ] T14 Measure: main JS gzip (today ~40 KB) must not grow; 3D chunk size reported; scroll/drag frame time on a mid phone. Optimize only from numbers.
### Checkpoint 2d: PASS + physical iPhone/iPad/desktop list.

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| WebGL on phones: jank or battery | High | CSS-3D is the default floor; Threlte only when capable; measure in T14; 3D never on player/controls |
| `three` chunk size hurts first load | Med | Dynamic import on idle, only on Library/Collection, budget stated and reported |
| Texture memory leaks across navigations | Med | Dispose on destroy; test by navigating Library ↔ Collection repeatedly (heap check) |
| v1→v2 migration loses videos | High | Migration test against a real v1 DB first; no destructive upgrade step |
| View Transition support varies (iOS) | Low | Feature-detect; no-op fallback; reduced motion respected |
| iPhone Safari bottom bar hides the player strip (seen in the owner's screenshot 2026-11-19) | Low | Separate small fix (dvh/safe-area), not part of slice 2 unless the owner asks |

## Out of scope
Instagram/TikTok/HLS, `/v1/health` and dead-link screen (slice 3), PWA install/share target/export-import/offline (slice 4), CI workflow, app icon.

## Decisions made by the owner (2026-11-19)
- A video belongs to one user collection only (move); "Todos" always shows everything.
- Order 2a → 2b → 2c → 2d (2D first, 3D last).
