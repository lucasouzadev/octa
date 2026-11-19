# ADR-0002 — Links only, no media storage

Date: 2026-11-19 · Status: accepted (owner)

## Decision
The product never uploads, downloads, transcodes, re-hosts or proxies video bytes. It stores a link plus metadata and plays through the platform's official embed or the browser's native `<video>` pointing at the original URL. When a link dies, the item says so; we do not keep a copy.

## Why
It is the product's promise ("while the link lives"), keeps storage cost near zero, and respects platform terms and creators' control over their content.

## Consequences
Playback depends on each platform's embed policy (Instagram/TikTok controls are limited; some videos disable embedding → `restricted`). Health checking is a core feature, not an extra. Any feature request that implies keeping media (offline download, "save a copy") conflicts with this ADR and must go to the owner.
