# QA round 5 — owner's iPhone screenshots, 2026-11-22

| ID | Finding | Cause | Status |
| --- | --- | --- | --- |
| R5.1 | Color bar at the top of the Library, worse in the installed PWA | R4.6 experiment: fixed black strip over white screens | Fixed (3242932), device test pending |
| R5.2 | Organizar mixes data tools with organization; needs sort/move/drag on Library and collections | Design | Fixed: 2 pages (part A, #41); drag handle for videos in a collection (part B). Device: NOT RUN |
| R5.3 | Motion permission asked again at every launch | `initTilt` did not resume a grant | Fixed (db43ec7). "+ menu asks" NOT reproduced: test passes on main |
| R5.4 | Feedback should be top banners, not pills | Toast styling | Fixed (03fcf79) |
| R5.5 | Safe areas lose the screen color during navigation | Page color came from the mounted page via `:has()` | Fixed (3242932), device test pending |
| R5.6 | Sheets can be pulled up, leaving a stripe | `dragOffset` allowed a negative rubber band | Fixed (cc23648) |

Evidence: vitest 347/347, `pnpm check` 0 errors, targeted e2e on phone (qa5, qa4-top, transitions, pwa) 18 passed. Full e2e NOT RUN.
Physical (iPhone PWA): R5.1, R5.3 relaunch, R5.5 navigation, R5.6 pull-up.
