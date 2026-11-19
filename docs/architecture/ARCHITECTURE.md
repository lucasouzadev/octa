# ARCHITECTURE — octa

Status: accepted 2026-11-19 (ADR-0001..0003). Per-platform rules: `PROVIDERS.md`.

## 1. Shape
```
iPhone / iPad / desktop browser
└── web/  SvelteKit PWA (static, adapter-static)
    ├── IndexedDB  ← the user's library (source of truth)
    ├── players    ← official iframes / native <video>, loaded on demand
    └── fetch /v1/*  ──►  api/  Go service (stateless)
                              ├── URL parser + provider registry
                              ├── oEmbed / Open Graph fetcher (SSRF-hardened)
                              ├── health checker (bounded goroutine pool)
                              └── in-memory TTL cache
```
One repo, two apps: `api/` and `web/`. No database server. No user data on the server.

## 2. Repository layout (target)
```
api/
  cmd/api/main.go            # wiring, config from env, graceful shutdown
  internal/httpapi/          # handlers, JSON, CORS, rate limit, request IDs
  internal/provider/         # one file per source: youtube.go, instagram.go, tiktok.go, direct.go
  internal/fetch/            # safe HTTP client (SSRF guard, limits)
  internal/health/           # batch checker
  internal/cache/            # TTL cache
  go.mod
web/
  src/lib/providers/         # client-side URL parser (mirror of api/internal/provider, shared test vectors)
  src/lib/db/                # IndexedDB access (idb), schema + migrations, export/import
  src/lib/players/           # YouTubePlayer.svelte, InstagramPlayer.svelte, TikTokPlayer.svelte, NativePlayer.svelte
  src/lib/three/             # Threlte scenes (FanStack, PaperStack) + CSS fallbacks
  src/lib/ui/                # Pill, IconButton, ColorScreen, Card…
  src/lib/tokens.css         # generated from docs/design/tokens.json
  src/routes/                # / (library), /add, /c/[id], /v/[id]
  static/manifest.webmanifest
testdata/urls.json           # shared URL test vectors (Go + Vitest read the same file)
docs/
```

## 3. Stack (verify versions at setup — AGENTS.md §1.11)
| Layer | Choice | Why |
|---|---|---|
| API | Go (1.27.x, verified 2026-11-19), stdlib `net/http` + `http.ServeMux` patterns | single binary, goroutines for health checks, no framework needed |
| API deps | as few as possible: `golang.org/x/net/html` (OG parsing), `golang.org/x/time/rate` | supply-chain surface small |
| Web | Svelte 5 (runes) + SvelteKit 3, `adapter-static`, TypeScript (verified 2026-11-19: svelte 5.58, kit 3.4, vite 8, TS 7) | small bundle, fine-grained reactivity, owner wants to learn it |
| 3D | Threlte (Three.js), lazy-loaded per route | declarative 3D in Svelte; only on Library and Collection |
| Motion | View Transitions API (SvelteKit `onNavigate`), Svelte `spring`/`tweened` | card → player morph without a router hack |
| Layout | container queries, `clamp()` fluid type, logical properties | same layout on every screen size |
| Color | `oklch()` tokens | smooth single-color screen transitions |
| Storage | IndexedDB via `idb` | local-first, works offline |
| PWA | `@vite-pwa/sveltekit` (or SvelteKit service worker, decide in slice 4) | install, offline shell, share target |
| HLS | `hls.js`, only where the browser lacks native HLS | Safari plays HLS natively |
| Tests | Go `testing` + `httptest`; Vitest; Playwright (390/834/1440 viewports) | |
| Package manager | pnpm | |

## 4. API contract (v1, JSON, CORS restricted to the PWA origin)
`POST /v1/resolve`
```json
// request
{ "url": "https://youtu.be/abc123" }
// 200
{ "source": "youtube", "kind": "video|short|reel|direct",
  "id": "abc123", "canonicalUrl": "https://www.youtube.com/watch?v=abc123",
  "embed": { "type": "iframe|video|hls", "src": "https://www.youtube-nocookie.com/embed/abc123", "aspect": "16:9|9:16" },
  "title": "…", "author": "…", "thumbnail": "https://i.ytimg.com/…", "durationSec": null,
  "health": "alive|dead|restricted|unknown", "checkedAt": "2026-11-19T12:00:00Z" }
// 422 { "error": "unsupported_url" | "invalid_url" }   400 bad_request   413 too_large   429 rate_limited
// Upstream failure is NOT an error: 200 with parser fields, fallback title/thumb and "health": "unknown"
```
`POST /v1/health`
```json
{ "items": [ { "id": "local-uuid", "url": "https://…" } ] }          // ≤ 50 items
{ "results": [ { "id": "local-uuid", "health": "dead", "checkedAt": "…" } ] }
```
`GET /healthz` → `200 ok` (liveness only).

Rules: unknown fields ignored; strings trimmed and length-capped (URL ≤ 2048); responses never echo raw upstream HTML; errors are codes, not stack traces.

## 5. Data model (IndexedDB, db `octa`, versioned)
```ts
type Health = 'alive' | 'dead' | 'restricted' | 'unknown';
interface Video {
  id: string;            // crypto.randomUUID()
  url: string;           // as pasted
  canonicalUrl: string;  // dedupe key (unique index)
  source: 'youtube' | 'instagram' | 'tiktok' | 'direct';
  kind: 'video' | 'short' | 'reel' | 'direct';
  embed: { type: 'iframe' | 'video' | 'hls'; src: string; aspect: '16:9' | '9:16' };
  title: string; author?: string; thumbnail?: string; durationSec?: number;
  health: Health; checkedAt?: string; deadStreak: number;
  favorite: boolean; positionSec?: number; lastOpenedAt?: string;
  createdAt: string; updatedAt: string;
}
interface Collection { id: string; name: string; order: string[] /* video ids */; createdAt: string; updatedAt: string; }
```
Stores: `videos` (indexes: `canonicalUrl` unique, `health`, `lastOpenedAt`), `collections`, `meta` (schema version, last health sweep). Export file: `{ "app": "octa", "schema": 1, "exportedAt", "videos": [...], "collections": [...] }`; import validates schema and dedupes by `canonicalUrl`.

## 6. Security (threat model: `docs/agents/standard/THREAT-MODEL.md`)
- **SSRF is the top risk** — the API fetches user-supplied URLs. `internal/fetch` must: allow only `http`/`https`; resolve DNS and reject loopback, private (RFC 1918, ULA), link-local (incl. `169.254.169.254`), CGNAT, multicast and unspecified addresses; re-check on every redirect (custom `DialContext` that validates the dialed IP, not just the hostname); max 3 redirects; 5 s total timeout; read ≤ 1 MB; no cookies; fixed User-Agent. Direct-video checks use `HEAD` (fallback `GET` with `Range: bytes=0-0`), never download the body.
- oEmbed endpoints are a fixed allowlist (YouTube, TikTok). Never build an oEmbed URL from user input other than the encoded `url` parameter.
- Rate limit per IP (token bucket); `/v1/health` batch ≤ 50, concurrency pool ≤ 16 outbound requests.
- CORS: only the PWA origin(s) from env. No auth in v1 → no secrets in the web bundle.
- Web: strict CSP — `frame-src` limited to `www.youtube-nocookie.com www.instagram.com www.tiktok.com`; `media-src https:`; `img-src https: data:`; no inline scripts. Iframes get `sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"` and `referrerpolicy="strict-origin-when-cross-origin"`. Titles from upstream render as text, never HTML.
- Logging: method, route, status, latency, request ID. Never log full user URLs in production (log source + host only).

## 7. Performance budgets
- Web initial JS (library route, without Threlte) ≤ 120 KB gzip; Threlte chunk loads after first paint, only on routes that use it.
- LCP ≤ 2.0 s on mid phone 4G; INP ≤ 200 ms; no layout shift from thumbnails (fixed aspect boxes).
- 3D scenes: ≤ 1 WebGL canvas on screen, pause rendering when off-screen or tab hidden, DPR capped at 2.
- Players mount only on the Player route; thumbnails are `loading="lazy"` images.
- API: p95 `/v1/resolve` ≤ 800 ms with cache miss, ≤ 30 ms hit; cache TTL 6 h for metadata, 1 h for health.

## 8. Deploy (proposal — owner decides before slice 4)
- API: container (distroless) on Fly.io or Railway, one small instance, env: `ALLOWED_ORIGINS`, `PORT`.
- PWA: static hosting (Vercel/Netlify/Cloudflare Pages), HTTPS required for service worker and share target.
- CI (GitHub Actions): `go test`/`go vet`/`govulncheck` + `pnpm check`/`test`/`build` + Playwright on PRs.
