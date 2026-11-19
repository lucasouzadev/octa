# STATUS — what is actionable now

Updated 2026-11-19. Progress only — the product is defined in `docs/product/SPEC.md`.

| Slice | Scope (SPEC §8) | State |
|---|---|---|
| 0 | Docs, agent-kit, ADRs, design system | DONE 2026-11-19 |
| 1 | Paste → resolve → card → player (YouTube long/Shorts, direct .mp4); `/v1/resolve`; URL parser + shared vectors; minimal library list | IN REVIEW — branch `feat/slice-1`, PR open, not merged |
| 2 | NEXT · Library + collections, Threlte fan/stack + CSS fallback, search, View Transitions | — |
| 3 | Instagram, TikTok, HLS; `/v1/health`; health states; Dead link screen; resume | — |
| 4 | PWA install, share target, export/import, offline shell, E2E 3 viewports, deploy (owner picks host) | — |

## Slice 1 — evidence (2026-11-19)
- API: `go test -race ./...` PASS (provider vectors, SSRF guard incl. redirect to 169.254.169.254, resolver, handlers), `go vet` PASS, `govulncheck` no vulns.
- Web: `pnpm test` 74 PASS, `pnpm check` 0 errors, `pnpm build` PASS (~40 KB gzip JS), `pnpm test:e2e` 24 PASS (8 flows × 3 viewports).
- Manual: real API + preview resolved a real YouTube video; screenshots read at 390 and 1440.

## Known gaps carried to slice 2+
- Library has no skeleton while IndexedDB loads (fast, but violates ux-check "never blank").
- Rate limit on Render: `CLIENT_IP_HEADER` unset = ONE shared bucket for all users (30/min, burst 10; proven by a 40-request burst: 10x422 + 30x429). `CF-Connecting-IP` looks per-client (forging it gives 403 at the edge; a burst got no 429) but is NOT PROVEN from a single egress IP. Prove from a phone on 4G, then set it.
- No CI workflow yet (slice 4): tests run locally only.
- Concurrent double paste of the same link can hit the unique index (rare; handle in slice 2).

## Owner decisions pending
- App icon.
- Hosting decided and live: PWA on Vercel (`web`), API on Render free (`octa-api`, virginia). Health Check Path `/healthz` still to be set by the owner in the Render dashboard (the tool cannot set it).
