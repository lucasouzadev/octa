# STATUS — what is actionable now

Updated 2026-11-19. Progress only — the product is defined in `docs/product/SPEC.md`.

| Slice | Scope (SPEC §8) | State |
|---|---|---|
| 0 | Docs, agent-kit, ADRs, design system | DONE 2026-11-19 |
| 1 | Paste → resolve → card → player (YouTube long/Shorts, direct .mp4); `/v1/resolve`; URL parser + shared vectors; minimal library list | NEXT — needs owner "yes" on the slice plan |
| 2 | Library + collections, Threlte fan/stack + CSS fallback, search, View Transitions | — |
| 3 | Instagram, TikTok, HLS; `/v1/health`; health states; Dead link screen; resume | — |
| 4 | PWA install, share target, export/import, offline shell, E2E 3 viewports, deploy (owner picks host) | — |

## Slice 1 — tests to write first
- Go: table tests over `testdata/urls.json` for the YouTube and direct providers; `internal/fetch` rejects `http://127.0.0.1`, `http://169.254.169.254`, `http://10.0.0.1`, `file://`, a public host redirecting to a private IP; handler tests for 200/422/429.
- Web: Vitest for the client parser (same vectors) and IndexedDB repo (fake-indexeddb); Playwright smoke: paste a YouTube link → card → player iframe present.

## Owner decisions pending
- App icon.
- Hosting for API and PWA (before slice 4).
