# ADR-0004 — Cinema player over official embeds

Date: 2026-11-19 · Status: accepted (owner: "um cinema pessoal", option "Projetor oficial")

## Decision
The viewer shows one octa player look for every source: cover first, platform player loaded on tap, platform chrome turned off where the platform documents a way (YouTube IFrame API `controls=0`, TikTok player v1 parameters), and one octa control bar below the picture driven through the official APIs (YouTube IFrame API, TikTok postMessage). Instagram keeps its embed. Direct files and HLS use a bare `<video>`.

## Why
The owner wants the video to feel native, without platform clutter, login prompts or waits. Extracting or proxying a platform's stream would breach the platforms' terms and ADR-0002, so the closest legitimate path is the official embeds with their documented controls hidden.

## Consequences
- YouTube may still show its logo/title at moments; covering it is forbidden (RMF: no overlays). Our bar stays outside the frame.
- Behaviour depends on the platforms' embed APIs; a change upstream can bring chrome back. Confirm on a real device.
- Rejected: stream extraction (yt-dlp-like), byte proxy, overlays that hide platform UI.
