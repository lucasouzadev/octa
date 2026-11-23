package provider

import (
	"net/url"
	"regexp"
	"strings"
)

var (
	igCodeRe     = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)
	tiktokIDRe   = regexp.MustCompile(`^[0-9]{5,25}$`)
	tiktokUserRe = regexp.MustCompile(`^@[A-Za-z0-9._-]{1,64}$`)
)

func isInstagramHost(host string) bool {
	return strings.TrimPrefix(host, "www.") == "instagram.com"
}

// parseInstagram matches /reel/, /reels/, /p/ and /tv/ links. Query strings (igsh and
// friends) are dropped. Photo posts cannot be told from video posts offline; the
// player simply shows whatever the official embed shows.
func parseInstagram(u *url.URL) (Ref, bool) {
	if !isInstagramHost(u.Hostname()) {
		return Ref{}, false
	}
	segs := strings.Split(strings.Trim(u.Path, "/"), "/")
	if len(segs) < 2 || !igCodeRe.MatchString(segs[1]) {
		return Ref{}, false
	}
	code := segs[1]
	var kind, canonical string
	switch segs[0] {
	case "reel", "reels":
		kind, canonical = "reel", "https://www.instagram.com/reel/"+code+"/"
	case "p":
		kind, canonical = "video", "https://www.instagram.com/p/"+code+"/"
	case "tv":
		kind, canonical = "video", "https://www.instagram.com/tv/"+code+"/"
	default:
		return Ref{}, false
	}
	return Ref{
		Source: "instagram", Kind: kind, ID: code, CanonicalURL: canonical,
		Embed: Embed{Type: "iframe", Src: canonical + "embed/", Aspect: "9:16"},
	}, true
}

// TikTokShortHost reports links that only a redirect can turn into /@user/video/ID.
// The resolver follows them through internal/fetch; the parser never touches the network.
func TikTokShortHost(host string) bool {
	return host == "vm.tiktok.com" || host == "vt.tiktok.com"
}

func isTikTokHost(host string) bool {
	switch strings.TrimPrefix(host, "www.") {
	case "tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com":
		return true
	}
	return false
}

// parseTikTok matches https://www.tiktok.com/@user/video/ID (also on m.tiktok.com).
func parseTikTok(u *url.URL) (Ref, bool) {
	host := strings.TrimPrefix(u.Hostname(), "www.")
	if host != "tiktok.com" && host != "m.tiktok.com" {
		return Ref{}, false
	}
	segs := strings.Split(strings.Trim(u.Path, "/"), "/")
	if len(segs) < 3 || !tiktokUserRe.MatchString(segs[0]) || segs[1] != "video" || !tiktokIDRe.MatchString(segs[2]) {
		return Ref{}, false
	}
	id := segs[2]
	return Ref{
		Source: "tiktok", Kind: "short", ID: id,
		CanonicalURL: "https://www.tiktok.com/" + segs[0] + "/video/" + id,
		Embed:        Embed{Type: "iframe", Src: "https://www.tiktok.com/player/v1/" + id, Aspect: "9:16"},
	}, true
}

// ShortTikTokURL returns the normalised URL when raw is a vm./vt.tiktok.com short link.
func ShortTikTokURL(raw string) (string, bool) {
	u, err := normalize(raw)
	if err != nil || !TikTokShortHost(u.Hostname()) {
		return "", false
	}
	return u.String(), true
}
