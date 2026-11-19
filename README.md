# octa

Paste a link, get a player. A video library built only from links — YouTube, Shorts, Reels, TikTok and direct video files. Nothing is uploaded or downloaded; each video lives here while its link lives.

- `api/` — Go service that resolves links and checks if they are still alive (stateless).
- `web/` — Svelte 5 + SvelteKit PWA, library stored on the device.

Start here: [`AGENTS.md`](AGENTS.md) (for coding agents and humans) · [`docs/product/SPEC.md`](docs/product/SPEC.md) · [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) · [`docs/design/DESIGN.md`](docs/design/DESIGN.md) · [`docs/STATUS.md`](docs/STATUS.md)

Built with the [agent-kit](https://github.com/lucasouzadev/agent-kit-skill) work track.

## Run it locally

Needs Go ≥ 1.21 (the right toolchain, 1.27.x, downloads itself), Node 22 and pnpm.

```bash
# terminal 1 — API on :8080
cd api && go run ./cmd/api

# terminal 2 — PWA on :5173 (proxies /api to the API)
cd web && pnpm install && pnpm dev --host
```

- Desktop: open http://localhost:5173
- Phone/tablet on the same Wi-Fi: open `http://<your computer's LAN IP>:5173` (macOS: `ipconfig getifaddr en0`). Plain http works; share falls back to "copy link".
- Tests: `cd api && go test ./...` · `cd web && pnpm test && pnpm check` · `cd web && pnpm exec playwright install chromium && pnpm test:e2e`
