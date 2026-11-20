# DESIGN — octa

Status: approved 2026-11-19 (prototype in `README.md` here). Tokens: `tokens.json` → generated into `web/src/lib/tokens.css`. When the prototype and this file disagree, this file wins; when the owner says otherwise, the owner wins.

## 1. Principles
1. **Content is the interface.** One focal element per screen; everything else steps back. Empty space is intentional, not unfinished.
2. **Black and white by default.** Library is white; collection and player are black. **Color appears only on action screens** — a whole screen of one solid color, never accents sprinkled on chrome.
3. **≤ 3 visible actions per screen** (one recorded exception: the viewer has four, Compartilhar · Mover · Curtir · Próximo, by owner order in QA round 1). Secondary actions live in gestures (swipe, long press, drag) and must also be reachable by keyboard/screen reader (a "Mais" menu in the a11y tree).
4. **Same layout everywhere.** Phone, tablet and desktop share one composition; only scale and spacing grow. No separate "desktop version", no sidebars.
5. **Objects, not widgets.** Videos behave like physical things (cards, paper, stacks) — that is where 3D lives. Controls stay flat and quiet.

## 2. Color
| Token | Value | Use |
|---|---|---|
| `bg.light` | `#FFFFFF` | Library |
| `bg.dark` | `#000000` | Collection, Player |
| `surface.light` | `#F4F4F4` | collection cards; icon buttons `#F2F2F2` |
| `surface.dark` | `#161616` | pills and icon buttons on black |
| `paper` | `#F3F1EC` | video cards in the stack (paper object), edges `#D8D5CE → #A19E98` |
| `text.light` / `text.dark` | `#0A0A0A` / `#FFFFFF` | |
| `muted.onLight` | `#5C5C5C` | meta on white (passes 4.5:1) |
| `muted.onDark` | `#A3A3A3` (meta), `#8A8A8A` (hints ≥ 12px) | |
| `action.create` | `#1A3CFF` | Paste link / add / onboarding screen |
| `action.alert` | `#FF6A2B` (text `#0A0A0A`) | Dead link / restricted |
| `action.success` | `#00804A` | reserved: import done, first collection |
| `action.favorite` | `#2F6B4F` (muted text `#DCE7E1`, `muted.onFavorite`) | the Favoritos screen: a matte green, not the loud success green (QA round 3) |
| `highlight.marker` | `#FFE14D` | marker-pen stroke behind a collection's name on the delete screen (text stays `#0A0A0A`) |
| `status.dead` | `#C2410C` | small "Fora do ar" label on paper |

Author tokens in `oklch()` in CSS (hex here is the reference). Screen color changes animate the background through View Transitions (cross-fade 320 ms), never a hard cut. Every color pair must pass 4.5:1 (3:1 for ≥ 24px text).

## 3. Type
- **Display / content titles:** Newsreader (serif), weight 400, tracking −0.01 to −0.02em. Video titles, collection names, screen headlines.
- **UI:** Inter 400/500/600. Buttons, meta, labels.
- Fluid scale (min @390px → max @1440px): display `clamp(46px, 4vw + 30px, 72px)`; title `clamp(30px, 1.5vw + 24px, 40px)`; h2 `clamp(24px, 1vw + 20px, 30px)`; body 16–17px; meta 13px; label 12px uppercase, tracking 0.12em, weight 600.
- Copy is pt-BR, short, human ("Cole um link.", "Esse link saiu do ar.").

## 4. Space, shape, layout
- Spacing scale (px): 4, 8, 12, 16, 20, 24, 28, 36, 48, 64, 96. Screen padding 24–28 (phone) → 5vw (desktop).
- Content column: `max-width: 720px`, centered. Library cards: one column on every size (they just get wider, up to the column).
- Radius: pill = height/2; icon button 44×44 circle; collection card 30; video frame 20 (24 desktop); thumb 12; paper card 10.
- Touch targets ≥ 44px. Primary pill height 60 (phone) / 56 (desktop row of three).
- Use container queries on components (`@container`), not viewport breakpoints.

## 5. Screens (prototype names)
| # | Screen | Ground | Focal element | Actions (max 3) |
|---|---|---|---|---|
| 1 | Paste link | `action.create` | headline + one URL field | Gerar player |
| 2 | Library | white | collection cards with fanned 3D thumbs | search, add |
| 3 | Collection | black | 3D paper stack of videos | back, Assistir em sequência |
| 4 | Player | black | the video | next, save, share (+ close, timeline) |
| 5 | Dead link | `action.alert` | headline + faded tilted thumb | Remover da coleção, Manter e checar de novo |
| 6 | Player desktop | black | same as 4, more space | same as 4 |

## 6. 3D (spot use — ADR-0003)
- **Where:** fanned thumbnails on Library cards; the paper stack in Collection; the tilted dead thumb. **Never** on a playing video or on controls.
- **How:** Threlte scene per component (`FanStack`, `PaperStack`) with textured planes, soft shadow, slight perspective; tilt follows drag/scroll with a spring (stiffness ~0.15, damping ~0.8). Defaults: fan tilt 16°, stack rotateX 14°.
- **Fallback (required):** the same composition in CSS 3D (`perspective`, `rotateY/rotateZ`) — used when `prefers-reduced-motion`, WebGL missing, `navigator.hardwareConcurrency ≤ 4`, or Save-Data. With reduced motion, no tilt animation at all.
- One WebGL canvas visible at a time; stop the render loop when off-screen.

## 7. Motion
- Card → Player: View Transition with shared `view-transition-name` on the thumbnail → video frame (380 ms, `cubic-bezier(.2,.8,.2,1)`).
- Screen color change: background cross-fade 320 ms.
- Buttons: press scale 0.97, 120 ms. No bounce on text.
- Everything respects `prefers-reduced-motion: reduce` (transitions become instant fades ≤ 120 ms).

## 8. Iconography
Inline stroke SVG, 1.8px stroke, round caps, 20–22px in 44px targets. Set: search, plus, back, close, play (filled), next, heart (outline/filled), share, link. No emoji, no icon fonts.

## 9. Accessibility
Real `<button>`/`<a href>`; icon buttons have `aria-label`; favorite uses `aria-pressed`; iframes get `title` = video title; focus ring visible (2px, white on black / black on white, 2px offset); timeline is a horizontal list navigable by arrow keys; gestures always have a button equivalent.

## 10. Do not
Gradient washes, glassmorphism on content, colored chrome on B&W screens, more than 3 primary actions, platform logos as decoration, copying Pocket Feeds (name, icon, copy, layout code) or any reference app's assets.


## QA round 1 rules (owner, 2026-11-19)

- **Every sheet is `ui/Sheet.svelte`.** Handle, slide-in/out, drag up/down (1:1 down, rubber band up, closes past 1/3 height or on a flick), Esc and backdrop close, reduced motion = no animation. `sheet-rule.spec.ts` fails if any other file uses `<dialog` or `showModal(`.
- **SUPERSEDED by QA round 3 (2026-11-19): text entry no longer docks.** ~~Text entry on touch devices docks above the keyboard~~ ** (`ui/DockedInput.svelte`): the page does not scroll or move, only the field comes forward over a light dim; tap outside closes and keeps the text; Enter or the send icon sends; errors render inside the bar. Mouse devices keep the field in the page. Position comes from `visualViewport` (`lib/keyboard.ts`), so the same code works in Safari, an installed PWA and Capacitor.**
- **Create content** lives in one place: the Library "+" (shown only after the first link) opens a popover from the button (+ becomes −) with "Colar link" and "Nova coleção". No dashed card, no placeholder tiles.
- **Empty states** = line-art illustration (`ui/Illustration.svelte`, one stroke, currentColor) + action buttons. An empty collection is a plain card without the fan.
- **Long lists** get a back-to-top arrow (`ui/BackToTop.svelte`) after ~1.2 screens of scroll.
- **One color edge to edge:** html/body and the browser theme color follow the screen (`lib/screen.ts`): blue on /add and /c/new, white on the Library, black elsewhere.
- **Viewer fits the screen** without scroll or cut: `100svh` layout, the player is sized from its own container (`cqw/cqh`).
- **Surfaces:** dark cards use `surface.darkRaised`; light buttons `surface.lightButton`; contrast thresholds are tests (`contrast.spec.ts`).

## QA round 2 rules (owner, 2026-11-19)

- **Create menu:** the panel grows out of the "+" button; the button sits inside the panel, filled white, and becomes "−" (`ui/CreateMenu.svelte`).
- **Every remove/delete uses the orange screen** (`ui/DangerScreen.svelte`, `action.alert` #FF6A2B, browser color follows): collection delete, video delete, and a dead link (after 2 failed checks in a row; one failed check only marks the card). Destructive button is black, cancel is a quiet pill. Esc cancels.
- **Virtual collections:** Todos, Favoritos (liked, heart badge in 3D on the monitor) and Assistidos (watched). They are computed, never stored, cannot be renamed or deleted, and their names are reserved. Library cards for Favoritos/Assistidos appear only when non-empty.
- **Watched:** manual (viewer "Mais" sheet) plus automatic when a native `<video>` ends.
- **Edit:** a video's title and link can be changed (bad link and duplicates rejected); "Mais" in the viewer holds watched, edit, delete.
- **Rename a collection happens in the title itself** (one input, Enter saves, Esc cancels). No second input below.
- **App feel on mobile:** zoom and text selection are off (`user-scalable=no`, `user-select:none`), except inside fields; fields are >= 16px so iOS does not zoom. Accessibility tradeoff chosen by the owner.
- **SUPERSEDED by QA round 3:** ~~Docked bar is pinned to the visual viewport frame (`visualFrame` in `lib/keyboard.ts`), the page is locked while it is open; `?kbdebug` prints the measures on a real device.~~
- **Illustrations** are redrawn: one idea per scene, no overlaps, one stroke weight.
- NOT RUN: real iPhone/iPad.

## Cinema player (slice 3c, owner 2026-11-19: "um cinema pessoal")

- One look for every source. The viewer opens at once with the cover and our one big play button; the platform player (YouTube, TikTok) is already loaded under the cover, so the first tap starts the video with no wait. Instagram has no cover: its own player is the only one.
- YouTube runs through the IFrame Player API with `controls=0` (nocookie host); TikTok through player v1 with its chrome hidden by its documented parameters. Our single control bar (play/pause, time, progress slider, duration, fullscreen) sits BELOW the picture, never over it: YouTube's Required Minimum Functionality forbids overlays on the embedded player, and its logo/title may still show at moments. That is accepted.
- Instagram has no control API: it keeps its own player and shows no bar of ours.
- MP4/HLS: a plain `<video>` without browser controls, driven by the same bar.
- Under the bar: the provider in caps and a pill with the truncated original link, which opens the platform in a new tab.
- Never: downloading, extracting or proxying a platform's stream (ADR-0002, platform terms).
- **One play.** The big button exists only before the video starts; a half-watched video says where it stopped ("Continuar · 4:20"). After the first play all control is in the bar (its play button stays hidden until then).
- **No play mark on thumbnails** in the Library, Collection or search screens: a play button belongs to the player only.
- **Vertical video** fits the normal viewer smaller, with every action in view, and opens our full screen on play (slice 3e). Horizontal video enters full screen with the Tela cheia button. Full screen: black, safe areas, picture as big as it gets, our bar below it, exit button top-left.

## QA round 3 rules (owner, 2026-11-19, iPhone)

- **Paste link / New collection are plain screens again** (`ui/TextField.svelte`): no docked bar; one blue layer behind the page so no white shows while the keyboard is open; a mark icon (link / folder-plus) on the left of the header, aligned with the X on the right. `ui/DockedInput.svelte` and `lib/keyboard.ts` were removed.
- **Favoritos is an action screen in matte green** (`action.favorite`); the browser color follows (`themeColorFor(route, scope)`). Heart badges on the cards are plain black and white (DOM and WebGL read the badge's own colors).
- **Edit mode** (collection): the row buttons sit below the card, never to its right.
- **Delete video**: the cover is clear (no film), big (84% of the width), tilted. **Delete collection**: a fan of the collection's covers (CSS/WebGL fan, scaled for the screen) or, when empty, the "hand throws a player into the trash" illustration; the collection's name is marked with a highlighter (`highlight.marker`).
- **Every action in the sheets answers**: one global notice, shown at the top under the status bar like an in-app banner, (`lib/toast.svelte.ts`, `ui/Toast.svelte`, mounted in the layout so it survives navigation): watched/unwatched, video deleted, moved to X / taken out, changes saved, collection deleted, link copied.
- **Move sheet** shows the video on the sheet's crown: `Sheet` takes an optional `crown` snippet that straddles the top edge (half above, half inside); the panel and crown slide and drag together (`.rise`).
- **Safe area:** no strip or gradient under the status bar (removed at the owner's request: it got in the way of navigation).
- **Empty Library with collections:** the collection cards come first, then "Colar um link" / "Nova coleção" below them, no illustration; they disappear after the first video.
- **Create menu** has an exit animation (fold + items out, 220 ms; reduced motion closes at once).
- **Collection end:** no pulling past the end (`overscroll-behavior-y: none`), no extra room under the sticky button; the back-to-top arrow is its own 3D layer in front of the tilted screens.
- **Full screen** centers the picture (spare height split above and below); horizontal videos go edge to edge without rounded corners; the bar and the leave button keep their side margin.
- NOT RUN: real iPhone (iOS rubber band, Safari 3D z-order, status-bar sampling, keyboard white areas, real fullscreen).
