# HANDOFF — 2026-11-19 — project setup (slice 0)

## Goal
Video library built only from links (no media storage) — approved 2026-11-19 by owner: stack Go API + Svelte 5 PWA, local-first, spot 3D, the 6-screen visual prototype, and this documentation set.

## State (verified, with evidence)
- Implementation: docs only; no app code yet. agent-kit 1.12.0 installed (profile `standard`, pr-quality `local`).
- Merge: setup pushed to `main` of `lucasouzadev/octa` (direct push, owner-provided empty repo, 2026-11-19).
- Production: none.
- QA: N/A — no code.

## Decisions (and why)
- See `docs/agents/OWNER_DECISIONS.md` and `docs/adr/` (0001–0003).

## Files touched
- `AGENTS.md` — project section, invariants, map, do-not-reopen.
- `docs/product/SPEC.md`, `docs/architecture/ARCHITECTURE.md`, `docs/architecture/PROVIDERS.md`, `docs/design/*`, `docs/adr/*`, `docs/STATUS.md`, `docs/agents/OWNER_DECISIONS.md`.

## Next step (exact, first action)
Boot, then present the slice 1 plan from `docs/STATUS.md` (files, tests first, risks; verify current Go/Svelte/SvelteKit versions) and ask the owner for "yes" with AskUserQuestion.

## Risks / blocked / owner decisions needed
- Instagram metadata may be blocked for anonymous fetches (PROVIDERS.md) — fallback card is planned.
- Owner: app icon; hosting before slice 4.
