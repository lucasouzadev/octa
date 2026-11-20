# PROVIDERS — how each source is parsed, embedded and health-checked

Each source is one provider in `api/internal/provider/` with a mirror parser in `web/src/lib/providers/`. Both read the same vectors in `testdata/urls.json` (input URL → expected `source`, `kind`, `id`, `canonicalUrl`, or `unsupported`). Add a vector before changing a parser (test first).

Provider interface (Go):
```go
type Provider interface {
    Match(u *url.URL) bool
    Parse(u *url.URL) (Ref, error)                    // pure, no network
    Resolve(ctx context.Context, r Ref) (Meta, error) // oEmbed / OG, via internal/fetch
    Health(ctx context.Context, r Ref) (Health, error)
}
```

**Upstream behaviour changes.** Status codes and embed rules below are what we expect today; platforms change them. Confirm each against the live endpoint when implementing (record the date in the test name or a comment) and keep the mapping in one place per provider.

## YouTube (long, Shorts, live)
- Hosts: `youtube.com`, `www.`, `m.`, `music.`, `youtu.be`, `youtube-nocookie.com`.
- ID: `v` query param, or path `/shorts/ID`, `/live/ID`, `/embed/ID`, `youtu.be/ID`. ID = 11 chars `[A-Za-z0-9_-]`. Keep `t`/`start` as a start offset, drop everything else (tracking params).
- Kind: `/shorts/` → `short` (aspect 9:16); else `video` (16:9).
- Canonical: `https://www.youtube.com/watch?v=ID`.
- Embed: `https://www.youtube-nocookie.com/embed/ID?playsinline=1&rel=0` (+ `start=`). Use the IFrame Player API for next/end events.
- Metadata: oEmbed `https://www.youtube.com/oembed?format=json&url=<canonical>` → title, author_name, thumbnail_url. Thumbnail fallback: `https://i.ytimg.com/vi/ID/hqdefault.jpg`.
- Health: oEmbed status — 200 `alive`; 401/403 `restricted` (private or embedding disabled); 404 `dead`; other/timeout `unknown`.

> **Slice 3a status (2026-11-19):** parsers, vectors, embeds, resolver mappings and HLS playback are built and tested against mocks. The live upstream behaviour of Instagram (OG tags, login wall) and TikTok (oEmbed status codes, thumbnail hosts) is **NOT confirmed**: this sandbox has no route to those platforms. Confirm on a real network before trusting `health` for them. TikTok short links (`vm.`/`vt.`) are expanded by the API (`internal/fetch`, redirects checked per hop); the client re-parses the returned canonical URL and accepts only a TikTok video. HLS: Safari native, others `hls.js` 1.7.4 loaded on demand; the stream host must allow CORS for hls.js. Content-Type sniffing for extension-less links is not built (such links are unsupported).

## Instagram (Reels, posts)
- Hosts: `instagram.com`, `www.`. Paths `/reel/CODE`, `/reels/CODE`, `/p/CODE`, `/tv/CODE`. CODE = `[A-Za-z0-9_-]+`. Drop query (`igsh` etc.).
- Kind: `reel` (9:16); `/p/` → `video` if it turns out to be a video, else unsupported (photos are out of scope).
- Canonical: `https://www.instagram.com/reel/CODE/`.
- Embed: `https://www.instagram.com/reel/CODE/embed/` in an iframe. No play/pause control from our side; the timeline "next" just swaps the iframe.
- Metadata: official oEmbed needs a Meta app token — **not in v1**. Try Open Graph (`og:title`, `og:image`) from the public page through `internal/fetch`; Instagram often blocks anonymous fetches → fall back to title "Reel do Instagram", author from nothing, generic thumb. Never scrape logged-in content or use private APIs.
- Health: page status 404 → `dead`; 200 → `alive` only if the response is the post (not a login wall); login wall/blocked → `unknown` (do not mark dead on a block).

## TikTok
- Hosts: `tiktok.com`, `www.`, `m.`, `vm.tiktok.com`, `vt.tiktok.com` (short links: follow redirects through `internal/fetch` to get `/@user/video/ID`). ID = digits.
- Kind: `short` (9:16). Canonical: `https://www.tiktok.com/@user/video/ID`.
- Embed: `https://www.tiktok.com/player/v1/ID?controls=0&...` (TikTok chrome hidden, octa control bar drives it via postMessage, slice 3c).
- Metadata: oEmbed `https://www.tiktok.com/oembed?url=<canonical>` → title, author_name, thumbnail_url (thumbnail URLs expire: re-resolve when the image 403s).
- Health: oEmbed 200 `alive`; 400/404 `dead`; other `unknown`.

## Direct video
- Match: http(s) URL whose path ends in `.mp4`, `.m4v`, `.webm`, `.mov` (→ `video`) or `.m3u8` (→ `hls`); or a `HEAD` `Content-Type` of `video/*` / `application/vnd.apple.mpegurl`.
- Canonical: the URL without fragment. Aspect: read from `loadedmetadata` on the client, default 16:9.
- Embed: native `<video controls playsinline preload="metadata">`; HLS via native Safari or `hls.js`.
- Metadata: title = file name (decoded, without extension) until the user renames; thumbnail = first frame captured on the client (canvas) when CORS allows, else a neutral tone block.
- Health: `HEAD` (fallback `GET` + `Range: bytes=0-0`): 2xx/206 `alive`; 404/410 `dead`; 401/403 `restricted`; other `unknown`. Never download the body.

## Unsupported
Return `422 unsupported_url`. The web shows the paste screen with "Esse tipo de link ainda não é suportado. Por enquanto: YouTube, Shorts, Reels, TikTok e arquivos de vídeo" and keeps the text in the field.

A TikTok `vm.`/`vt.` short link is the one case the client cannot parse alone, so the web asks the API to expand it (timeout 20 s, long enough for a free-tier API waking up). If the API cannot be reached (offline, timeout, 5xx, wrong `VITE_API_BASE`) the web shows "Não consegui abrir o link curto do TikTok agora…" (client error `resolver_unavailable`), never "não é suportado". Only an API answer of `422 unsupported_url` means the link itself is unsupported.
