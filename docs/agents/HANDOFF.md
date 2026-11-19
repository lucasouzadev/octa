# HANDOFF — 2026-11-19 — API live on Render, web points to it

## Goal
Video library from links; API on Render free + PWA on Vercel. Plan: `tasks/plan.md` (last section).

## State (verified)
- main at 33532b1 (PR #4 merged: `CLIENT_IP_HEADER`, `api/Dockerfile`).
- Render: service `octa-api` (`srv-dbv7k1qjnfac73crs94g`, virginia, free, Docker, context `api`) live at https://octa-api-os09.onrender.com. `/healthz` 200; real YouTube long and Short resolved with title/thumbnail; CORS only for https://web-chi-nine-h1xmk9enwg.vercel.app.
- Render env now: `ALLOWED_ORIGINS` only (`CLIENT_IP_HEADER` unset) -> one shared rate-limit bucket for everyone. Health Check Path not set (tool cannot): owner sets `/healthz` in the dashboard.
- Vercel: project `web` (`prj_aqPIj4gibbtfj9T5zK853FvpcGgf`), env `VITE_API_BASE` (production) = Render URL; production deploy READY at 33532b1 with alias web-chi-nine-h1xmk9enwg.vercel.app; the Render URL is in the built JS (route chunk). Other Vercel aliases (web-lucasouzadevs-projects..., web-git-main...) are NOT in the CORS allowlist.
- NOT RUN: in-browser paste of a real link on the Vercel app (title/thumbnail), reload of a real `/v/<id>`, iPhone/iPad checks. No CI workflow (slice 4).

## Decisions (and why)
- Never `X-Forwarded-For` on Render (appends; first entry forgeable, last is the edge).
- `True-Client-IP` rejected: not overwritten by the edge (forged values gave separate buckets, no 429).
- `CF-Connecting-IP`: forged -> 403 at the edge; burst got no 429 (value varies per request from the sandbox). Per-client behaviour unproven; header unset until a phone test.

## Next step (exact)
Owner: set Health Check Path `/healthz` in Render; on iPhone (4G) paste a real YouTube link in the app. Then, if wanted: agent bursts the API from the sandbox while the phone still resolves -> proves `CF-Connecting-IP` separates clients -> set `CLIENT_IP_HEADER=CF-Connecting-IP` (owner yes, redeploys).

## Risks / owner decisions
- Free instance sleeps after 15 min idle (~50 s cold start); web saves the link from the parser when the API fails.
- Shared bucket: one abuser or burst can 429 everyone for a minute.
- App icon open. Slice 2 (collections, 3D thumbnails, search, View Transitions) unplanned and not approved.
