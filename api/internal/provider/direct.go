package provider

import (
	"net/url"
	"path"
	"strings"
)

var directExts = map[string]bool{".mp4": true, ".m4v": true, ".webm": true, ".mov": true}

// parseDirect matches links to video files by extension. HLS (.m3u8) and
// Content-Type sniffing arrive in slice 3.
func parseDirect(u *url.URL) (Ref, bool) {
	ext := strings.ToLower(path.Ext(u.Path))
	if !directExts[ext] {
		return Ref{}, false
	}
	c := *u
	c.Fragment, c.RawFragment = "", ""
	canonical := c.String()

	title := strings.TrimSuffix(path.Base(u.Path), path.Ext(u.Path))
	if dec, err := url.PathUnescape(title); err == nil {
		title = dec
	}
	return Ref{
		Source: "direct", Kind: "direct", ID: canonical, CanonicalURL: canonical,
		Embed: Embed{Type: "video", Src: canonical, Aspect: "16:9"},
		Title: title,
	}, true
}
