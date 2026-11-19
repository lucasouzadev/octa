package provider

import (
	"net/url"
	"path"
	"strings"
)

var directExts = map[string]bool{".mp4": true, ".m4v": true, ".webm": true, ".mov": true}

// parseDirect matches links to video files by extension, and HLS playlists (.m3u8).
// Content-Type sniffing for extension-less links is not done: such links are unsupported.
func parseDirect(u *url.URL) (Ref, bool) {
	ext := strings.ToLower(path.Ext(u.Path))
	hls := ext == ".m3u8"
	if !directExts[ext] && !hls {
		return Ref{}, false
	}
	c := *u
	c.Fragment, c.RawFragment = "", ""
	canonical := c.String()

	title := strings.TrimSuffix(path.Base(u.Path), path.Ext(u.Path))
	if dec, err := url.PathUnescape(title); err == nil {
		title = dec
	}
	kind, embedType := "direct", "video"
	if hls {
		kind, embedType = "hls", "hls"
	}
	return Ref{
		Source: "direct", Kind: kind, ID: canonical, CanonicalURL: canonical,
		Embed: Embed{Type: embedType, Src: canonical, Aspect: "16:9"},
		Title: title,
	}, true
}
