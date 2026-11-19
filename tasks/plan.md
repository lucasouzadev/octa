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
