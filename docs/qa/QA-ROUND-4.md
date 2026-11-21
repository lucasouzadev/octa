# QA round 4 — findings (2026-11-21)

Source: two owner iPhone screen recordings (A: 174 s, B: 53 s, 04:39–04:43) plus a read-only code review of `main` (84c03aa).
Method: 24-frame grids, then close frames and 1 fps strips around every change; each finding is tied to a timestamp and to code.
Marks: **SEEN** = visible in the recording; **CODE** = proven by reading the code; **INFERRED** = a hypothesis, not proven.
Nothing was changed by this review. Frames were kept in a scratch folder and deleted (they show contacts and another app).

## R4.0 Main CI is red (found first, outside the recordings)
- CI on `main` after the merge of #36: job `e2e` fails `pwa.e2e.ts:47` ("the Library opens with no network") on all 3 viewports, retry included. API and web jobs pass. Run: actions/runs/44831802207.
- Cause (CODE, reproduced locally): the conflict resolution of the #36 merge dropped `serviceWorker: { register: true }` and `paths: { relative: false }` from `web/vite.config.ts`. Offline `/c/new` then asked for `/c/_app/immutable/...` and got nothing.
- Why it slipped through: #35 had no CI (no workflow yet), and the green run of #36 was on a branch cut before #35 merged.
- Fix prepared and verified, NOT committed: restore the two lines. `pwa.e2e.ts` + `csp.e2e.ts` 36 passed; full e2e 598 passed / 5 failed (all timing tests, see Test debt); `pnpm check` 0 errors; unit 326 passed.

## Findings (ordered by what to do first)

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| R4.1 | high | **Slow capture of link content.** Paste shows "Gerando…" for ~4 s (56–59 s in A), then opens the player with the generic title "Vídeo do YouTube" and no author. The title never recovers while the person is in the viewer. One video (BIZARRO) kept the generic title for the whole 3 minutes. | SEEN A 56–60 s, A-09/A-13/A-17/A-19; CODE `links.ts:11` (`RESOLVE_TIMEOUT_MS = 4000`), `enrich.ts:15` (`needsEnrich` = health unknown AND never checked), `enrich.ts` runs only from `routes/+page.svelte:56` (Library open). INFERRED: the BIZARRO video was already health-checked, so `needsEnrich` is false forever; Render free cold start (~50 s) explains the first miss. |
| R4.2 | high | **No press feedback on most buttons.** 38 `<button>` in markup, 6 `:active` rules in total, and `-webkit-tap-highlight-color: transparent` removes the system feedback. Header icons, pills, "Assistir em sequência", "Gerar player", "Criar coleção", sheet options, chips (Editar/Mover/Apagar) answer a tap with nothing. | CODE `app.css:63`, `app.css:120` (`.icon-button` only), `routes/v/[id]/+page.svelte:389` (viewer actions only), `CreateMenu.svelte:134`. SEEN: no pressed state in any tap of A or B. |
| R4.3 | high | **Motion permission prompt on a random tap.** After every launch the first tap anywhere (here: "+") raises the iOS question "Deseja Ter Acesso a Movimento e Orientação". "Cancelar" is not remembered, so it returns at the next launch. | SEEN B 33 s and 41 s (prompt over the open "+" menu, twice). CODE `tilt.svelte.ts:116-121`: with the saved choice "on" on iOS, `initTilt` arms a capture `pointerup` listener that calls `enableTilt()`; a denial sets `tilt.denied` in memory only (`save` runs on success). |
| R4.4 | high | **Video not centred in the viewer.** The picture and its bar sit in the lower half: ~230 px of black above, ~40 px below (one video, no strip). | SEEN A-09 (1:01), A-20 to A-23 (2:22–2:44, one video without strip), strip at 63–64 s. CODE `Cinema.svelte:~397`: `.screen { place-items: end center }` with the comment "spare height goes above it". It was chosen in slice 3e (fit) and now reads as a defect. |
| R4.5 | medium | **Organizing options missing.** The data layer can reorder videos (`Library.reorder`, `library.ts:222`) and the copy promises it ("define a ordem de assistir"), but the collection screen only offers Editar / Mover / Apagar per video. Organizar (Library header) covers collections only: no reorder or sort of videos, no Organizar on the collection screen, no multi-select move. | CODE `routes/c/[id]/+page.svelte:260-262`, `OrganizeSheet.svelte:46-57`. SEEN A 04:39–04:42 (Favoritos/Todos edit mode). |
| R4.6 | medium | **Top of the Library looks washed out.** Content scrolling under the status bar fades to white, the header ghosts ("Minha coleção"). | SEEN A-01, A-14, B-01. CODE: the app draws no gradient, blur or sticky bar there (grep `gradient/backdrop-filter/sticky` finds none on the Library); the strip of R3.10 was removed in #29. INFERRED, NOT PROVEN: the iOS 26 scroll-edge effect over a white page. Needs an on-device experiment. |
| R4.7 | medium | **Delete has no undo.** "Vídeo apagado" is final; a mis-tap on the orange confirm loses the video. | SEEN A-18. CODE `routes/v/[id]/+page.svelte:127`, `routes/c/[id]/+page.svelte:149`. |
| R4.8 | low | **Grey cover flash on cold open.** Library fans draw grey cards with only "SHORTS/YOUTUBE" for ~1–2 s after the app is launched (covers are not cached offline by design). | SEEN A-13, B 30 s. |
| R4.9 | low | **Double exposure in screen transitions.** For ~0.3 s two screens overlap semi-transparent (Collection over player, danger screen over the monitor, "BIZARRO" twice). | SEEN A-04, B-08. CODE `app.css:161` (cross-fade 320 ms). |

## Proposed order
1. R4.0 (main red) — own PR, already prepared.
2. Quick batch, one test run: R4.4, R4.3, R4.2 (all XS/S, no open decision).
3. R4.1 (M): warm the API when `/add` opens, honest progress copy, keep resolving after saving and update the viewer, `needsEnrich` also for generic titles.
4. Decisions needed: R4.5 (which options), R4.6 (experiment), R4.7 (undo).
5. Later: R4.8, R4.9.

## E2E to write first (red, then green) — `web/src/routes/qa4.e2e.ts`, 3 viewports
- R4.1: resolve answers after 6 s → the video is saved with the generic title and the viewer shows the real title once the API answers; opening `/add` fires one warm-up request; a generic title with a past `checkedAt` is still enriched (unit test on `needsEnrich` first).
- R4.2: for every control class (icon button, pill, CTA, chip, sheet option, tab) the computed style changes while the pointer is down.
- R4.3: with `DeviceOrientationEvent.requestPermission` stubbed and the saved choice "on", a tap on "+" never calls it; only the Organizar switch does; a denial persists across a reload.
- R4.4: the picture/bar group of a single video is centred in the stage within 24 px, horizontal and vertical video.
- R4.5 / R4.7 after the owner's decision.

## Test debt seen in the same runs (not caused by these findings)
- Timing-fragile under load: `transitions.e2e.ts:46` (failed in 3 of 3 full runs, passes alone), `monitors.e2e.ts:104`, `qa1.e2e.ts:337`, `qa3.e2e.ts:137`, `qa2.e2e.ts:68`/`:299`. Fixtures in `stacks` and `sources` still carry a fixed 2026-11-19 `checkedAt`.

## NOT proven
- Everything iPhone-specific stays an inference from video: the scroll-edge effect (R4.6), cold-start timing (R4.1), the real motion prompt behaviour after a reinstall.
- No frame-by-frame audit of A between 1:10 and 2:55 beyond the 24-frame grid; the strips above were taken only around the findings.
