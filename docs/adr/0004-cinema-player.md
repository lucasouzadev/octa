# ADR-0004 — Cinema player over official embeds

Date: 2026-11-19 · Status: accepted (owner: "um cinema pessoal", option "Projetor oficial")

## Amendment 2026-11-23 (R7.2, owner: "o player será mais 'nativo'")
Supersedes the Decision below: no cover, no big play, no octa bar, no fullscreen of ours. The platform's own player and controls run the video (YouTube `controls=1`, `fs=1`; TikTok player v1 and Instagram embed plain; `<video controls>`). Adapters only listen (position, end) for resume and "assistido". Still official players only (ADR-0002). YouTube/TikTok fullscreen under the iframe `allow`/`sandbox` is not verified on a real iPhone.

## Decision (original)
The viewer shows one octa player look for every source: cover first, platform player loaded under the cover (amended 2026-11-19, slice 3d), platform chrome turned off where the platform documents a way (YouTube IFrame API `controls=0`, TikTok player v1 parameters), and one octa control bar below the picture driven through the official APIs (YouTube IFrame API, TikTok postMessage). Instagram keeps its embed. Direct files and HLS use a bare `<video>`.

## Why
The owner wants the video to feel native, without platform clutter, login prompts or waits. Extracting or proxying a platform's stream would breach the platforms' terms and ADR-0002, so the closest legitimate path is the official embeds with their documented controls hidden.

## Consequences
- YouTube may still show its logo/title at moments; covering it is forbidden (RMF: no overlays). Our bar stays outside the frame.
- Behaviour depends on the platforms' embed APIs; a change upstream can bring chrome back. Confirm on a real device.
- Rejected: stream extraction (yt-dlp-like), byte proxy, overlays that hide platform UI.

## Amendment — slice 3d (2026-11-19, owner's iPhone recordings)
First build loaded the platform player only after the tap. On iOS the video then was not started by that tap (the API loaded after the gesture), so the person met a second play inside the platform's own player, plus a ~4 s black wait. Now: the platform player loads UNDER the cover when the screen opens, the tap on our big button calls play inside the same gesture, and the cover goes away once the video plays. If the platform still refuses (iOS), the cover steps aside after 2.5 s so the platform's own play is the single one to tap. Not provable from the sandbox: needs the owner's iPhone.
Still true: YouTube's title/logo/centre button inside the picture cannot be hidden (RMF forbids covering or cropping them).

## Amendment — slice 3e (2026-11-19, owner's iPhone feedback)
- Vertical video no longer takes 68% of the height: the normal viewer fits the screen with every action in view. Vertical videos are watched in OUR full screen, opened on play. iPhone Safari cannot full-screen an iframe, so the full screen is a fixed black layer over the viewport (bar kept below the picture), with the browser's native fullscreen requested on top where it exists.
- Touches: while playing, the platform iframe has `pointer-events: none`; a tap on the picture toggles play/pause through the official API. This keeps the platform HUD from reacting to touch. It does not cover or crop the player (RMF intact). If the platform refused to start, pointer events return so its own play works.
- Optimistic UI: play/pause show at once; a contradicting platform event within 0.9 s is treated as old news.
