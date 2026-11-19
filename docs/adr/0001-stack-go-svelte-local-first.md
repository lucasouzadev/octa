# ADR-0001 — Go API + Svelte 5 PWA, local-first

Date: 2026-11-19 · Status: accepted (owner)

## Context
The app turns links into players; the only server work is resolving metadata and checking whether links are alive. The owner wants to learn Go (absent from their GitHub) and a front-end stack that is also new and strong at UI/motion. v1 must ship without accounts.

## Decision
- `api/`: stateless Go service on the standard library (`net/http`), bounded goroutine pool for health checks, in-memory TTL cache.
- `web/`: Svelte 5 + SvelteKit with `adapter-static`, installed as a PWA; library stored in IndexedDB; JSON export/import.
- No database server and no user data on the server in v1.

## Alternatives rejected
- Go + templ + HTMX: more Go, but forces server-side storage and weakens offline/3D/motion.
- React/TypeScript: owner already knows it; less learning.
- Expo native first: slower to iterate and test; can wrap the same API later.

## Consequences
Library is per device until sync exists (a future ADR). The API must be safe for anonymous use (SSRF guard, rate limits) because it has no auth.
