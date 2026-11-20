# HANDOFF — 2026-11-20 — Organize collections (drag + Organizar sheet)

## Goal
Owner 2026-11-20: toast on top (PR #28), 3D follows the phone (PR #30), drag-and-drop reorder + "Organizar" header button (this branch). Decisions: Organizar = sheet (sort Minha ordem/A–Z/recentes/mais vídeos + Reordenar); virtual collections fixed on top; tilt switch moved into the sheet. Owner said "Pode codar" (2026-11-20).

## State (verified)
- PR #27 `fix/qa-round-3` → #28 `feat/toast-top` (based on #27); #30 `feat/device-tilt` (based on #27); owner merges.
- `feat/organize-collections` is based on `feat/device-tilt` (needs #30 merged first). Implemented: `lib/organize.ts` (+spec), `Collection.rank` + `setCollectionRanks`, `OrganizeSheet`, Reordenar mode on the Library, MoveSheet order, tilt switch moved, `organize.e2e.ts`, tilt e2e adapted.
- `pnpm test` 295 PASS, `pnpm check` 0 errors, organize+tilt e2e PASS (3 viewports). Full e2e: see PR.
- NOT proven: finger drag on real iPhone (mouse only), auto-scroll feel.
- Pre-existing flaky: `health.e2e.ts:29` (fails on main), `health.e2e.ts:17`, `enrich.e2e.ts:5` under load.

## Next step
Owner tests on the iPhone preview. Open: `VITE_API_BASE` for Vercel Preview; slice 4 (PWA install, share target, export/import — export must include `rank`).

## Risks / owner decisions needed
- Export/import (slice 4) must carry `Collection.rank`.
- Reordering inside a collection (videos) already exists; not touched.
