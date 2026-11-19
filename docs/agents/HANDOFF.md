# HANDOFF — 2026-11-19 — API on Render (free): image + client IP ready, not deployed

## Goal
Host the Go API on Render free so the Vercel PWA can resolve links. Plan: `tasks/plan.md` (last section).

## State (verified)
- Main at f6315e2 (slice 1 merged). Web production on Vercel (project `web`, `web-chi-nine-h1xmk9enwg.vercel.app`) READY; `/v/teste` returns 200 with the app shell (rewrite OK). Real `/v/<id>` reload in a browser: NOT RUN.
- Branch `feat/render-api` (PR open, not merged): `CLIENT_IP_HEADER` + tests, `api/Dockerfile`, `.dockerignore`.
- API `go test -race ./...` PASS, `go vet` PASS. Native static build + local run: healthz 200, CORS preflight OK, limiter per forged header IP OK.
- `docker build`: BLOCKED (no Docker daemon in the agent sandbox). Render builds it on deploy; check the build log.
- Render workspace "My Workspace" (`tea-d3a28ibuibrs73bl99dg`) has one free service (`Hotel-Flor-de-Lima`); no octa service yet. Deploy: NOT DONE.

## Decisions
- Client IP: trusted single-IP header via env, fallback RemoteAddr; never XFF on Render. `True-Client-IP` to be confirmed by a forged-header burst test after deploy.
- CORS allowlist = Vercel production URL only.

## Next step (exact)
After the PR is merged: ask "yes" to create the Render web service (plan step 3), then "yes" for `VITE_API_BASE` + Vercel redeploy (step 4), then smoke (step 5).

## Risks / owner decisions
- If the forged-header test shows `True-Client-IP` is forgeable, change strategy before exposing widely (fallback: RemoteAddr = one shared bucket, or Cloud Run).
- App icon still open. Slice 2 unplanned and not approved.
