# HANDOFF — 2026-11-19 — slice 3a (Instagram, TikTok, HLS) in review

## Goal
Close the main plan: 2e-3 (merged, PR #17) -> 3a sources -> 3b health -> 4 PWA + CI.

## State (verified)
- Branch `feat/slice-3a-sources`, PR open (not merged).
- API: `go vet`, `go test -race ./...` PASS. Web: check 0/0, 228 unit PASS, build PASS, e2e 318 PASS + 1 flaky (`enrich.e2e.ts` desktop, passes alone).
- NOT RUN: live Instagram/TikTok behaviour (no route from sandbox), real iPhone, CI, govulncheck.

## Open owner question (2026-11-19 16:27)
Owner wants a "projector": play YouTube/Instagram/TikTok videos as if native, without the platform HUD, with the provider and a truncated link below. This conflicts with ADR-0002 (official players only, no extraction/proxy) and the platforms' terms. Options were put to the owner; nothing built yet. Do not start slice 3b until answered if the answer changes the player.

## Next step (exact)
Owner answers the player question and tests 3a. Then 3b (/v1/health, real dead-link check, Continuar assistindo), then slice 4.

## Risks / owner decisions
- Render limiter shared bucket; `/healthz` unset; app icon open; no CSP yet.
