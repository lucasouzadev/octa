# SPEC — octa

Status: accepted 2026-11-19. Visual source: `docs/design/README.md`. Owner decisions: `docs/agents/OWNER_DECISIONS.md`.

## 1. Objective
Let a person keep and watch videos from anywhere on the web **by link only**. Paste a link → a player appears → it stays in the library and plays any time, **while the link lives**. No upload, no download, no account.

## 2. Users and jobs
- Saves clips, Reels and Shorts seen on social apps to watch later, in one calm place.
- Groups videos by theme (collections) and binge-watches a collection in sequence.
- Wants to know when a saved video died, without opening it to find out.

## 3. Supported links (v1)
| Source | Examples | Player |
|---|---|---|
| YouTube long | `youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/live/ID` | YouTube iframe (nocookie) |
| YouTube Shorts | `youtube.com/shorts/ID` | YouTube iframe, 9:16 |
| Instagram Reels / posts | `instagram.com/reel/CODE`, `/p/CODE` | Instagram embed page, 9:16 |
| TikTok | `tiktok.com/@user/video/ID`, `vm.tiktok.com/…` | TikTok embed v2, 9:16 |
| Direct video | `…/file.mp4`, `.webm`, `.m3u8` | native `<video>` (hls.js where Safari lacks native HLS — desktop Chrome/Firefox) |

Anything else → friendly "link not supported yet" state; nothing is saved. Parsing rules per platform: `docs/architecture/PROVIDERS.md`.

## 4. Flows
1. **Paste link** (blue screen): one field, one button. Also opens from the OS share sheet (Web Share Target) and from clipboard paste anywhere in the app. Duplicate link → open the existing item.
2. **Resolve**: web calls `POST /v1/resolve`; shows the card (thumb, title, author, duration if known, source). On API failure the item is still saved with what the URL parser knows (source + id) and resolved later.
3. **Library** (white): collections as cards with fanned 3D thumbnails, name and count. Header: search, add. A default collection "Todos" always exists.
4. **Collection** (black): videos as a 3D paper stack; tap a card → player. One primary action: "Assistir em sequência".
5. **Player** (black): video centered, author, serif title, 3 pill actions (next, save/favorite, share), thumbnail timeline at the bottom to jump. Remembers position for native `<video>`; for embeds remembers "last opened" only.
6. **Dead link** (orange): shown when health is `dead`. Two actions: remove from collection, or keep and re-check tomorrow.
7. **Manage**: rename/delete collection, move item, export/import JSON (versioned schema).

## 5. Link health ("while the link lives")
- States: `alive`, `dead` (removed/404), `restricted` (private, region, embed disabled), `unknown` (could not check).
- Checked on app open for items not checked in the last 24 h, in batches via `POST /v1/health`, and before playing if older than 24 h.
- `dead` twice in a row (≥ 12 h apart) → show the Dead link screen; one failure only marks the card. Never auto-delete.

## 6. Acceptance (v1)
- A1 Pasting a supported link shows the resolved card in ≤ 2 s p75 on 4G (API warm) and plays in-app.
- A2 Each source in §3 plays on iPhone Safari (installed PWA), iPad Safari and desktop Chrome/Safari/Firefox.
- A3 A removed/private video shows `dead`/`restricted` within one check cycle; the UI never shows a broken iframe without explanation.
- A4 Library survives reload and offline; export → import round-trips with zero loss.
- A5 Same layout at 390, 834 and 1440 px wide (only scale/spacing change); ≤ 3 visible actions per screen.
- A6 `prefers-reduced-motion` removes 3D tilt and view-transition motion; Lighthouse PWA installable; a11y: all actions are real buttons/links with labels, contrast ≥ 4.5:1.
- A7 API rejects private/loopback/metadata IPs and non-http(s) schemes (tests prove it).

## 7. Out of scope (v1)
Accounts, sync, social/sharing feeds, comments, downloads or offline video, recommendations, uploads, any scraping of logged-in content, native apps (an Expo shell may come later, reusing the API).

## 8. Build slices (order; each ends green and demoable)
1. **Paste → resolve → card → player** for YouTube (long + Shorts) and direct `.mp4`; API `/v1/resolve`, URL parser, minimal Library list.
2. **Library**: collections, fanned 3D thumbs (Threlte + CSS fallback), collection stack, search, View Transitions card → player.
3. **More sources + health**: Instagram, TikTok, HLS; `/v1/health`, health states, Dead link screen, "Continuar assistindo".
4. **PWA polish**: install, share target, export/import, offline shell, E2E on three viewports.

## 9. Open questions (owner)
- App icon (name: octa, from the repository, 2026-11-19).
- Hosting choice for API and PWA (proposal in ARCHITECTURE §Deploy) — decide before slice 4.
