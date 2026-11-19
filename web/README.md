# octa — web

Svelte 5 + SvelteKit 3 PWA (static, SPA fallback). Library lives in IndexedDB. Rules: [`../AGENTS.md`](../AGENTS.md), design: [`../docs/design/DESIGN.md`](../docs/design/DESIGN.md).

```bash
pnpm install
pnpm dev          # :5173, /api proxied to the Go API on :8080
pnpm test         # Vitest (parser vectors, library, token sync)
pnpm check        # svelte-check
pnpm build        # static site in build/
pnpm test:e2e     # Playwright at 390 / 834 / 1440 px (API mocked)
```

Imports use the `#lib/*` subpath alias with explicit extensions (`#lib/links.ts`).
