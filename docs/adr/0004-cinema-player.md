# ADR-0004 — Cinema player over official embeds

Date: 2026-11-19 · Status: accepted (owner: "um cinema pessoal", option "Projetor oficial")

## Decision
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
