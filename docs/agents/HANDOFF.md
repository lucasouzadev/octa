# HANDOFF — 2026-11-20 — Device tilt (PR open, stacked)

## Goal
Owner 2026-11-20: 3D follows the phone's movement; then drag-and-drop reorder + "Organizar" header button; toast on top. Order approved: toast (PR #28), tilt (this), drag/organizer (needs a spec first). Decisions: organizer = sheet with sort (A–Z, recent, most videos, manual) + "Reordenar"; virtual collections fixed on top; tilt permission via a switch.

## State (verified)
- PR #27 `fix/qa-round-3` (QA round 3 + strip removal): open, owner merges. PR #28 `feat/toast-top` (toast at top): open, based on #27. This branch `feat/device-tilt` is based on #27 (not on #28).
- Tilt: implemented; `pnpm test` 282 PASS, `pnpm check` 0 errors, tilt e2e 18 PASS (phone, tablet; desktop skipped). Full e2e: see PR.
- NOT proven: real sensor, iOS permission prompt, WebGL consumers (no e2e on the lean of the WebGL scenes), battery cost.
- Pre-existing failing: `health.e2e.ts:29` (fails on main too).

## Next step (exact)
Owner tests tilt on the iPhone preview. Then drag-and-drop: write a spec first (pointer-events drag with long press, auto-scroll, IndexedDB v3 `order` field, keyboard move up/down, interplay with tilt and the 3D fan) and get approval.

## Risks / owner decisions needed
- The switch is a third header button; it moves into "Organizar" when that exists.
- `VITE_API_BASE` for Vercel Preview still unset.
