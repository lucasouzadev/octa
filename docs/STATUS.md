# STATUS — what is actionable now

Updated 2026-11-20. Progress only — the product is defined in `docs/product/SPEC.md`.

| Slice | Scope (SPEC §8) | State |
|---|---|---|
| 0 | Docs, agent-kit, ADRs, design system | DONE 2026-11-19 |
| 1 | Paste → resolve → card → player (YouTube long/Shorts, direct .mp4); `/v1/resolve`; URL parser + shared vectors; minimal library list | DONE 2026-11-19 — merged (PR #1, #3); API live on Render, PWA on Vercel; owner confirmed on iPhone |
| 2 | Library + collections, Threlte fan/stack + CSS fallback, search, View Transitions (plan: `tasks/plan.md`) | 2a collections (2D) DONE (PR #6 merged, owner tested 2026-11-19); 2b search DONE (PR #7 merged, owner approved); 2c View Transitions DONE (PR #8 merged, owner tested); 2d-i CSS-3D fan and stack DONE (PR #9 merged, owner approved on iPhone); iOS findings fix DONE (PR #10 merged); 2d-ii WebGL fan DONE (PR #11 merged, owner approved); 2e-1 Library cards per the prototype DONE (PR #12 merged, owner approved); 2e-2 Collection screen as tilted 3D screens IN REVIEW — branch `feat/slice-2e2-collection-screens`; 2e-3 WebGL monitors IN REVIEW (branch `feat/slice-2e3-webgl-monitors`) |
| 3 | Instagram, TikTok, HLS; `/v1/health`; health states; Dead link screen; resume | 3a sources DONE (PR #18/#20 merged); 3c cinema player DONE (PR #21 merged); 3b `/v1/health` + real dead-link check + resume IN REVIEW — branch `feat/slice-3b-health` (home card "Continuar assistindo" pending owner decision) |
| 4 | PWA install, share target, export/import, offline shell, E2E 3 viewports, deploy (owner picks host) | — |

## QA round 3 (2026-11-20, branch `fix/qa-round-3`)
- Owner's iPhone QA, 13 items (R3.1–R3.13), one commit each (R3.1+R3.3 share the collection page and one commit); rules in `docs/design/DESIGN.md` § QA round 3.
- Evidence: see the PR description (G2 table). Unit, check, build and e2e results are recorded there, not here.
- NOT proven: everything iPhone-specific (iOS rubber band and arrow z-order on R3.1, keyboard white areas R3.6, status bar R3.10, 3D, real fullscreen R3.13).

## Fix — TikTok short link feedback (2026-11-20, branch `fix/tiktok-short-link-feedback`)
- Owner's iPhone screenshot: a `vt.tiktok.com` link was refused with "não é suportado". Cause (read-only checks): the Render API was still on the PR #4 commit (no TikTok), and `VITE_API_BASE` exists on Vercel for `production` only, so preview/branch builds call a relative `/api`; the client turned any failed expansion into `unsupported_url`.
- Changed: the paste screen copy (Reels/TikTok are supported), a new client error `resolver_unavailable` for a failed short-link expansion (offline, timeout, 5xx, wrong base), and a 20 s expansion timeout.
- Ops (owner-approved 2026-11-20): `octa-api` redeployed from main f456552, live 05:01 UTC; `/v1/resolve` for a canonical TikTok URL now answers 200.
- Evidence: `pnpm test` 266 PASS (5 new, 1 replaced; red first), `pnpm check` 0 errors, `pnpm test:e2e` 398 PASS / 19 skipped / 0 failed (417 tests).
- NOT proven: a real `vt.`/`vm.` link expanding from the Render API (a fake short link answered 422); iPhone; `VITE_API_BASE` for Vercel previews is still unset (owner decision).

## Fix — TikTok title and cover (2026-11-20, branch `feat/tiktok-handle-title`)
- Owner's iPhone screenshots: a TikTok saved fine but showed a grey cover and the title "Vídeo do TikTok". Cause (checked 2026-11-20 against the live endpoint and the live API): TikTok's public oEmbed answers 200 with no `title`, `author_name` or `thumbnail_url`; the video page has no `og:` tags.
- Changed (web only, no API deploy; owner chose the no-scraping option): title `Vídeo de @handle` and author `@handle` from the canonical URL; the API's generic title never overwrites it (a real API title still wins); cards and fans draw the handle instead of a grey cover when there is no thumbnail; saved TikToks that still have the generic title are upgraded on app open (edited titles untouched).
- Evidence: `pnpm test` 274 PASS (8 new, red first) · `pnpm check` 0 errors · `pnpm test:e2e` 400 PASS / 19 skipped / 1 FAIL: `qa2.e2e.ts:299` "Assistidos: mark in Mais" is flaky (passes alone; 2 of 36 reruns also fail on main without this change: the test navigates before the IndexedDB write commits). Covers inspected in phone screenshots.
- NOT proven: iPhone; a TikTok video recent enough to carry oEmbed metadata (none seen); real thumbnails are not possible without scraping.

## Slice 1 — evidence (2026-11-19)
- API: `go test -race ./...` PASS (provider vectors, SSRF guard incl. redirect to 169.254.169.254, resolver, handlers), `go vet` PASS, `govulncheck` no vulns.
- Web: `pnpm test` 74 PASS, `pnpm check` 0 errors, `pnpm build` PASS (~40 KB gzip JS), `pnpm test:e2e` 24 PASS (8 flows × 3 viewports).
- Manual: real API + preview resolved a real YouTube video; screenshots read at 390 and 1440.

## Slice 2a — evidence (2026-11-19)
- Web: `pnpm test` 99 PASS (25 new: v1→v2 migration on a real v1 DB, collection invariants, scope/playlist, double-paste race), `pnpm check` 0 errors, `pnpm build` PASS, `pnpm test:e2e` 48 PASS (16 flows × 3 viewports, two consecutive full runs). Screenshots read at 390 and 1440.
- JS gzip, all chunks, same method: main 45.5 KB → 2a 51.6 KB (+6 KB: two routes, DB v2).
- Race found and fixed by an e2e run: the move sheet closed before the IndexedDB write committed, so a quick navigation could lose the move.
- NOT RUN: iPhone/iPad/desktop physical checks of 2a; skeleton while loading is in the markup but not asserted (IndexedDB cannot be slowed from Playwright).

## Slice 2b — evidence (2026-11-19)
- Web: `pnpm test` 113 PASS (14 new in `search.spec.ts`: accents, case, author, every-word AND, ranking, stable order, regex characters literal, no mutation), `pnpm check` 0 errors, `pnpm build` PASS, `pnpm test:e2e` 66 PASS (22 flows × 3 viewports; 6 new search flows).
- JS gzip, all chunks, same method: 2a 51.6 KB → 2b 52.8 KB (+1.2 KB).
- Search is client-side over title + author of the whole library (not just one collection), results link to `/v/<id>?c=todos`.
- NOT RUN: iPhone/iPad/desktop physical checks of 2b (iOS keyboard, focus, zoom); CI (no workflow, slice 4).

## Slice 2c — evidence (2026-11-19)
- Web: `pnpm test` 117 PASS (4 new `transition.spec.ts`), `pnpm check` 0 errors, `pnpm build` PASS, `pnpm test:e2e` 78 PASS (26 flows x 3 viewports; 4 new, repeated 3x after a test race was fixed).
- JS gzip, all chunks, same method: 2b 52.8 KB → 2c 53.4 KB (+0.6 KB).
- Behavior: screen colors cross-fade 320 ms; a tapped list row's thumbnail morphs into the player frame (380 ms); reduced motion = 100 ms fade, no morph; no View Transitions = plain navigation. Library cards go to a Collection screen, so they only cross-fade (no shared element there).
- NOT RUN: seeing the animation (Playwright records the mode and the shared name at the call, not the pixels); iPhone Safari support and feel; CI.

## Slice 2d-i — evidence (2026-11-19)
- Scope: the CSS-3D floor only (ADR-0003 fallback). `FanStack` on Library cards, `PaperStack` on the Collection screen, `capability.ts` (gates for the later WebGL renderer). No `three` or Threlte yet.
- Web: `pnpm test` 126 PASS (9 new `capability.spec.ts`, seen red first), `pnpm check` 0 errors 0 warnings, `pnpm build` PASS, `pnpm test:e2e` 91 PASS + 2 skipped (hover test runs on desktop only), 31 flows x 3 viewports.
- JS gzip, all chunks: 2c 53.4 KB → 2d-i 54.3 KB (+0.9 KB). CSS grew with the two components.
- Screenshots read at 390 (Library fan, Collection stack): composition matches DESIGN §6. Not read at 834 and 1440.
- Reduced motion: pose kept, no transition, no hover fan-out. No pointer/drag tilt exists yet (the plan's spring tilt belongs to the Threlte renderer).
- NOT RUN: iPhone/iPad/desktop physical checks; frame time while scrolling (T14); CI.

## iOS findings fix — evidence (2026-11-19)
- From the owner's iPhone screenshots of 2d-i: (1) videos saved while Render was asleep kept the generic "Vídeo do YouTube" title (paste timeout 4 s < cold start ~50 s); (2) white strip above the black Collection screen; (3) sticky "Assistir em sequência" ran into the list rows.
- Fix: `enrich.ts` (`needsEnrich` = health unknown and never checked; `enrichPending` one video at a time, max 5 per Library open, 60 s timeout, best-effort, keeps favorite/collection because `update()` re-reads in its transaction); `html:has(.on-dark)` paints the page dark; footer gets a fade scrim.
- Web: `pnpm test` 135 PASS (9 new `enrich.spec.ts`, seen red first), `pnpm check` 0/0, `pnpm build` PASS, `pnpm test:e2e` 97 PASS + 2 skipped (2 new flows x 3).
- JS gzip, all chunks: 54.3 KB → 54.8 KB (+0.5 KB).
- NOT RUN: the three fixes on the real iPhone; CI. The scrim only shows with a long list; checked in code, not in a screenshot.
- Still open: Safari bottom bar over the player thumbnail strip; centered paper stack (cosmetic).

## Slice 2d-ii — evidence (2026-11-19)
- Scope: WebGL renderer for the Library fan only (`FanStack3D` + `FanScene`), behind the same props as the CSS fan. Deps pinned and checked on the registry: `@threlte/core` 8.7.0, `three` 0.187.0, `@types/three` 0.187.0; `pnpm audit --prod` clean.
- Gate: `canUseWebGL3D(readEnv())` (WebGL, no reduced motion, no Save-Data, more than 4 cores, memory above 4 GB when exposed). One canvas at a time (`active3d`: first visible card). Loads on idle in its own chunk; context loss gives the CSS fan back.
- Budget (same gzip method, all JS): main 54.8 KB → 56.6 KB (+1.9 KB, budget was +2 KB); 3D chunk 194 KB gzip, fetched only on capable devices. CSS gzip 7.7 KB.
- Web: `pnpm test` 135 PASS, `pnpm check` 0/0, `pnpm build` PASS, `pnpm test:e2e` 114 PASS + 6 skipped (mouse-only tests run on desktop); 8 WebGL flows x 3 viewports.
- Bugs found by testing, fixed in this PR: grey papers (material not recompiled when the texture arrived; DOM checks passed, a pixel test now guards it); the scene drew ~30 frames/s while idle (task auto-invalidate), then again after the spring settled (writes kept redrawing). Now idle draws 0 and a settled spring draws 0 (counted on `drawElements`).
- Screenshots read at 390 and 1440 (software WebGL in headless Chromium).
- NOT RUN: real iPhone/iPad GPU (frame time while scrolling, battery, memory); CI. Tilt follows the pointer only (no scroll-driven tilt). The Collection paper stack is still CSS.

## Slice 2e-1 — evidence (2026-11-19)
- Owner: "quero continuar o 3D. Siga as telas que criei." The PDF is byte-identical to `docs/design/prototype.pdf` (md5 checked). Gap list vs the prototype: Library cards (this PR), Collection as a stack of tilted cream paper cards (2e-2), WebGL for that stack (2e-3), dead-link tilted thumb (slice 3).
- This PR: card = name on top, fan, count below; fan = up to 5 bordered cards (landscape, Shorts/Reels/TikTok standing), source label in caps, newest on top, outer cards dropped and tipped; header "N coleções · M vídeos". One layout (`fan.ts`: `fanLayout`, `fanCards`, `cardLabel`) drives both the CSS-3D fan and the WebGL scene; in WebGL each card face is drawn on a 2D canvas (shadow, border, thumbnail, label) so the material never needs recompiling.
- Web: `pnpm test` 146 PASS (11 new `fan.spec.ts`, seen red first), `pnpm check` 0/0, `pnpm build` PASS, `pnpm test:e2e` 117 PASS + 6 skipped (mouse-only). Screenshots read at 390 (CSS) and 1440 (WebGL).
- JS gzip, all chunks, same method: main 56.6 KB → 57.2 KB (+0.6 KB); 3D chunk 194.7 KB gzip.
- Also: the enrich e2e flaked once in a full run (waited on a time, not on the signal); it now waits for the resolve response and retries the read.
- Differences from the prototype, on purpose or not yet: the prototype shows no "Todos" card (its three collections sum to 52 videos) while SPEC §4 says "Todos" always exists, so "Todos" stays first; shadows are soft, the prototype's are hard-edged parallelograms; the prototype's thumbnails are flat colors, ours are real covers; direct videos say "MP4" even when they are .webm/HLS (slice 3 refines).
- NOT RUN: real iPhone/iPad look and GPU; CI.

## Slice 2e-2 — evidence (2026-11-19)
- Owner: "esses elementos são em 3D. São como monitores." The Collection screen is now a pile of tilted screens (prototype page 3): cream bezel with thickness (three edge tones + cast shadow), 16:9 screen with play button, "SOURCE · length", status (ATIVO / FORA DO AR / RESTRITO, nothing for a link never checked), serif title (2 lines), later screens in front, header "N vídeos · K fora do ar", title centered. The old paper stack above the list is gone: the screens are the 3D elements.
- Pose and content come from `lib/shelf.ts` (`formatDuration`, `statusOf`, `shelfSummary`, `screenTilt`), 11 unit tests written first and seen red (module missing). CSS-3D renderer `ui/ScreenCard.svelte`; each row has its own perspective so every screen is foreshortened alike. Editing lays them flat and apart so Mover stays easy to hit; hover lifts a screen only with a pointer and without reduced motion.
- Web: `pnpm test` 157 PASS (146 before), `pnpm check` 0/0, `pnpm build` PASS, `pnpm test:e2e` all PASS at 3 viewports (stacks e2e rewritten: poses, thickness, play, source/status, overlap and z-order, dead link, editing flat, reduced motion, hover, empty). Screenshots read at 390 and 1440. Main JS gzip 57.2 → 57.7 KB; 3D chunk unchanged (~194.6 KB).
- Changed on purpose: the author no longer prints on a screen (the prototype shows only source and length); the enrich e2e now checks the recovered cover instead of the author. PaperStack.svelte removed.
- NOT RUN: real iPhone/iPad look; WebGL for these screens (2e-3); CI.

## QA round 1 — evidence (2026-11-19, owner iPhone QA, IDs R1.1–R1.8)
- R1.1/R1.2 docked input + Colar; R1.3 native sheet (rule for all sheets); R1.4 viewer fits, hearts on Curtir, order Compartilhar · Mover · Curtir · Próximo; R1.5 palette (contrast tests); R1.6/R1.6.1 "+" popover, empty states, no empty cards, back to top; R1.7 Assistir em sequência without band; R1.8 one color edge to edge.
- Web: `pnpm check` 0/0, `pnpm test` 186 PASS, `pnpm build` PASS, `pnpm test:e2e` 224 PASS at 3 viewports. Screenshots read at 390 (docked bar, popover, empty library).
- Honest notes: the R1.8 e2e and the hearts spec were written after the code (not seen red); old e2e updated to the new UI (Curtir label, 4 viewer actions, "+" menu instead of the dashed card). AGENTS "≤ 3 actions" exception recorded in DESIGN.md (owner order).
- NOT RUN: real iPhone (keyboard dock via visualViewport, Safari toolbar fit in the viewer, safe-area colors, heart animation feel); CI (none yet).
- Next: slice 2e-3 (WebGL for the Collection monitors).

## QA round 2 — evidence (2026-11-19, owner iPhone QA, IDs R2.1–R2.7)
- R2.1 menu from the button; R2.2 top margin, zoom/selection off, thinner fan border; R2.3 docked bar pinned to visualViewport; R2.4 CTA shadow fits, back-to-top visible; R2.5 illustrations redrawn; R2.6 orange DangerScreen for all removes and dead link; R2.7 edit title/link, Assistidos, Favoritos, inline rename.
- Web: `pnpm check` 0/0, `pnpm test` 204 PASS (new specs seen red first: visualFrame, manage, edit), `pnpm build` PASS, `pnpm test:e2e` all PASS at 3 viewports after updating 3 old tests (rename inline, reserved-name message); two flaky old tests (sheet drag on desktop, viewer actions order) passed 3x repeated.
- Honest notes: Favoritos 3D is minimal (heart badge on the monitor); "Manter e checar de novo" only resets the streak (real health check is slice 3).
- NOT RUN: real iPhone (docked bar, viewer fit, safe areas); CI (none yet).

## Slice 2e-3 — evidence (2026-11-19)
- Owner choice: ONE fixed canvas over the pile (keeps the one-canvas rule). `ui/MonitorLayer` + `MonitorScene` draw only monitors near the viewport (built on demand, freed when far), real thickness (extruded rounded body, 12 px), shadow, Favoritos heart standing off the corner. Faces are painted from the live DOM row (`monitorPaint.ts`), so WebGL and CSS cannot drift. Rows stay links with transparent paint (touch, focus, screen readers). Tilt = base pose + scroll position + mouse spring; touch tilts by scroll only.
- Gates unchanged: no WebGL, weak device, Save-Data, reduced motion, editing, a lost context, or a cover host without CORS (that row only) keep the CSS monitors.
- Web: `pnpm check` 0/0, `pnpm test` 213 PASS (9 new `monitor.spec.ts`, seen red first), `pnpm build` PASS, `pnpm test:e2e` all PASS at 3 viewports (5 new flows: one canvas and links, cover not grey, CSS fallbacks, Favoritos heart, idle draws nothing). One new test was flaky under full-suite load; hardened to wait for a stable draw count, 12/12 on repeat.
- Honest notes: the shared-element morph from a row into the player starts from a transparent row when WebGL is on (CSS monitors morph fine); thickness is subtle at the small resting angles; software GL only, no real GPU.
- NOT RUN: real iPhone/iPad GPU feel, scroll smoothness and battery; CI (none).

## Slice 3a — evidence (2026-11-19)
- Scope: Instagram (reel/reels/p/tv), TikTok (video + vm./vt. short links via API), HLS (.m3u8), labels Reels/Instagram/TikTok/HLS, viewer label "Arquivo" for direct files and HLS.
- API: shared vectors (`testdata/urls.json`) added first and seen red in Go and TS; resolver tests (oEmbed/OG mappings, login wall = unknown never dead, foreign thumbnails dropped, short-link expansion seam, HLS HEAD) written before the code. `go vet`, `go test -race ./...` PASS.
- Web: `hls.ts` (spec first), `parseOrExpand` in `links.ts` (4 specs first, seen red). hls.js 1.7.4 verified in the registry (AGENTS §1.11), loaded only for HLS links. `pnpm check` 0/0, `pnpm test` 228 PASS, `pnpm build` PASS, `pnpm test:e2e` 318 PASS + 1 FAIL under full-suite load (`enrich.e2e.ts` desktop, untouched by this slice; 3/3 PASS when re-run alone: flaky, not fixed here).
- Honest notes: NOT RUN against the live platforms (no route from this sandbox): Instagram OG/login wall, TikTok oEmbed codes and thumbnail hosts are per PROVIDERS.md, unconfirmed. Covers from Instagram/TikTok CDNs have no CORS, so those rows keep the CSS monitors (WebGL falls back per row). No CSP is configured yet (slice 4). HLS needs CORS on the stream host.
- NOT RUN: real iPhone; CI (none); govulncheck (not installed in this sandbox).

## Slice 3c — evidence (2026-11-19, cinema player, ADR-0004)
- Owner: "um cinema pessoal" without platform clutter; option "Projetor oficial" approved (extraction/proxy refused: platform terms + ADR-0002).
- Built: `ui/Cinema.svelte` (cover first, platform player on tap, one octa bar below the picture, provider + truncated original link), `lib/player/core.ts` (clock, start offset, YouTube state map, TikTok message envelope; 6 specs seen red first), `lib/player/adapters.ts` (YouTube IFrame API `controls=0` on the nocookie host, TikTok player v1 postMessage with source+origin check, native `<video>`). TikTok embed moved to `player/v1` with its chrome hidden (shared vectors changed first, Go seen red with `-count=1`). Old `Player.svelte` removed.
- Web: `pnpm check` 0/0, `pnpm test` 233 PASS, `pnpm build` PASS, `pnpm test:e2e` 331 PASS + 3 FAIL in the full run, all three fixed or hardened and passing on repeat: a 2d-ii test that assumed no canvas on /c/todos (now asserts exactly one, the monitors), and a Favoritos test that navigated before the like was written (now waits).
- API: `go test ./...` PASS.
- Honest notes: e2e drive a stand-in for the YouTube IFrame API that follows its documented surface; the real API, TikTok player v1 messages and their chrome-hiding are NOT RUN against the live platforms. YouTube may still show logo/title (cannot be covered). Instagram keeps its own player. iPhone fullscreen for embeds is limited (Safari only fullscreens a `<video>`).
- NOT RUN: real iPhone/iPad/desktop with real YouTube/TikTok; CI (none).

## Known gaps carried to slice 2+
- Rate limit on Render: `CLIENT_IP_HEADER` unset = ONE shared bucket for all users (30/min, burst 10; proven by a 40-request burst: 10x422 + 30x429). `CF-Connecting-IP` looks per-client (forging it gives 403 at the edge; a burst got no 429) but is NOT PROVEN from a single egress IP. Prove from a phone on 4G, then set it.
- No CI workflow yet (slice 4): tests run locally only.
- iPhone Safari bottom bar over the viewer: addressed in QA round 1 (R1.4) with `svh` layout; needs the owner's iPhone to confirm.

## Owner decisions pending
- App icon.
- Hosting decided and live: PWA on Vercel (`web`), API on Render free (`octa-api`, virginia). Health Check Path `/healthz` still to be set by the owner in the Render dashboard (the tool cannot set it).

## Slice 3b — evidence (2026-11-19)
- API: `POST /v1/health` (<= 50 items, <= 16 outbound at once, body cap 160 KB, optional `fresh` skips the 1-6 h cache, bad/unsupported item = `unknown` not an error, results carry the caller's id only, same rate limit as resolve). `Resolver.Check(ctx, raw, fresh)`; `cache.Delete`.
- Web: `health.ts` (sweep on Library open for links not checked in 24 h, in batches of 50; check before playing; real "Manter e checar de novo" = fresh check + streak restart; `unknown` and non-newer answers never overwrite what we know; dead streak counts only answers >= 12 h apart). Resume: position saved every 5 s, on pause and on leaving; read once on open (< 10 s or within 10 s of the end = from the start); YouTube `start`, TikTok `seekTo`, native `currentTime`; finished clears it.
- Tests: Go `go test -race ./...` PASS (new: batch order/ids, no URL echo, 51 items -> 413, concurrency bound, rate limit, fresh bypasses cache); web unit 257 PASS (16 + 3 `health.spec`, 5 `core.spec`); e2e `health.e2e.ts` 7 and `resume.e2e.ts` 4 flows x 3 viewports.
- NOT RUN: live YouTube/TikTok/Instagram health mappings (no route from sandbox; PROVIDERS.md says confirm on a real network), real iPhone, CI.

## Slice 3d — player rework (2026-11-19, from the owner's iPhone recordings)
- Findings: two plays (ours + YouTube's red button), ~4 s black wait after the tap, vertical video tiny (picture got what the title, 4 actions and strip left), a play on the cover and another in the bar, play marks over thumbnails on other screens.
- Fix: platform player loaded under the cover, tap plays in the same gesture, cover leaves when it plays (or after 2.5 s if the platform refuses, so its own play is the only one); big button only before start, with "Continuar · m:ss" for half-watched videos; bar play hidden until started; vertical ~68% of the screen; no play mark on the Collection screen cards or the 3D monitors; Instagram without cover.
- NOT RUN: the one-tap start on the real iPhone (iOS may still refuse; the fallback is built and tested with a fake YouTube that refuses), real TikTok. YouTube's title/logo/centre button inside the picture remain (cannot be hidden).

## Slice 3e — full screen, fit, touches, latency (2026-11-19, owner's iPhone feedback on 3d)
- Findings: the tall vertical stage pushed the action buttons below the fold; the Tela cheia button did nothing on iPhone (Safari only full-screens a `<video>`, not an iframe); the platform HUD pops up on touch; pause lagged behind our bar.
- Fix: the normal viewer fits the screen again (picture smaller, actions and strip visible, no scroll). Our own full screen (fixed, black, safe areas, bar below the picture, exit button, Esc) opens by itself on play for vertical videos and by the Tela cheia button for horizontal ones; where the browser allows it, native fullscreen is requested on the same container. While it plays, the iframe takes no touches (`pointer-events: none`) and a tap on the picture toggles play/pause, so the platform HUD does not pop up on touch; if the platform refused to start, its own play stays tappable. Play/pause answer at once on our side; a contradicting platform event within 0.9 s is ignored (`staleEvent`).
- NOT RUN: all of it on the real iPhone. Cannot be removed: the HUD YouTube shows by itself when it starts or pauses (title, logo, centre button); the real latency inside YouTube between our command and its pause.
