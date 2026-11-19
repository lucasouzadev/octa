# OWNER_DECISIONS — octa

Dated log of the owner's standing instructions (format and rules: `docs/agents/standard/OWNER-DECISIONS-TEMPLATE.md`).
Newest first. Never delete: mark `SUPERSEDED by <date>`. The current one-line rule lives in `AGENTS.md`.

## 2026-11-19 — Name and repository
Project name **octa**, repository `lucasouzadev/octa`. Prototype PDF added at `docs/design/prototype.pdf`.

## 2026-11-19 — Visual prototype approved
Owner approved the 6-screen prototype "extremely" (paste link, library, collection stack, player, dead link, desktop player). It is the visual source of truth until a later dated entry changes it. Canvas and PDF: `docs/design/README.md`.

## 2026-11-19 — Interface direction
Lots of empty space, content first. Same layout on mobile, tablet and desktop. Black and white by default; screens of a single solid color for action moments. 3D elements, used sparingly ("pontual"). Few buttons, objective; focus on content and the user's action. References: quote card (3 pill actions), "My things" fanned collections, single-color onboarding, iPad player with thumbnail timeline, stacked newspapers.

## 2026-11-19 — Stack
Go for the backend (owner wants to learn Go; least-used language in the owner's GitHub). Svelte 5 + SvelteKit PWA for the front (also new to the owner). Advanced front-end tech for UI/UX: Threlte (Three.js) for spot 3D, View Transitions API, container queries, fluid type, oklch colors.

## 2026-11-19 — Data on the device
v1 keeps the library only on the device (IndexedDB) with JSON export/import. No login, no sync.

## 2026-11-19 — Product
A video platform with no uploads: everything through links (Reels, Shorts, long YouTube videos, direct videos). The app builds a viewer the user watches whenever they want, while the link lives. The Pocket Feeds screen recording is a visual reference only — never copy its name, icon, copy or code.

## 2026-11-19 — Working style
The project follows agent-kit (https://github.com/lucasouzadev/agent-kit-skill): mandatory track, approval gate, decisions through AskUserQuestion, replies in pt-BR.
