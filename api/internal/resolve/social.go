package resolve

import (
	"context"
	"encoding/json"
	"html"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/lucasouzadev/octa/api/internal/fetch"
)

// Upstream behaviour confirmed against live endpoints: NOT YET (this sandbox has no
// route to the platforms). The mappings below follow docs/architecture/PROVIDERS.md;
// confirm each on a real network before trusting them, then record the date here.

func (r *Resolver) tiktok(ctx context.Context, m *Meta) {
	m.Title = "Vídeo do TikTok"
	q := url.Values{"url": {m.CanonicalURL}}
	res, err := r.f.Get(ctx, r.tiktokOEmbed+"?"+q.Encode())
	if err != nil {
		return
	}
	switch {
	case res.Status == http.StatusOK:
		m.Health = HealthAlive
	case res.Status == http.StatusBadRequest || res.Status == http.StatusNotFound:
		m.Health = HealthDead
		return
	default:
		return
	}
	var o struct {
		Title        string `json:"title"`
		AuthorName   string `json:"author_name"`
		ThumbnailURL string `json:"thumbnail_url"`
	}
	if json.Unmarshal(res.Body, &o) != nil {
		return
	}
	if t := clean(o.Title, maxTitle); t != "" {
		m.Title = t
	}
	m.Author = clean(o.AuthorName, maxAuthor)
	if hostHasSuffix(o.ThumbnailURL, "tiktokcdn.com", "tiktokcdn-us.com", "tiktok.com", "ibyteimg.com") {
		m.Thumbnail = o.ThumbnailURL
	}
}

var (
	ogTitleRe = regexp.MustCompile(`(?is)<meta\s[^>]*?(?:property\s*=\s*["']og:title["'][^>]*?content\s*=\s*"([^"]*)"|content\s*=\s*"([^"]*)"[^>]*?property\s*=\s*["']og:title["'])`)
	ogImageRe = regexp.MustCompile(`(?is)<meta\s[^>]*?(?:property\s*=\s*["']og:image["'][^>]*?content\s*=\s*"([^"]*)"|content\s*=\s*"([^"]*)"[^>]*?property\s*=\s*["']og:image["'])`)
)

func firstGroup(m []string) string {
	for _, g := range m[1:] {
		if g != "" {
			return g
		}
	}
	return ""
}

// instagram reads the public page's Open Graph tags. Instagram often blocks
// anonymous fetches: that is "unknown", never "dead". Only a 404 is dead, and only a
// page that carries the post's og:title counts as alive (a login wall does not).
func (r *Resolver) instagram(ctx context.Context, m *Meta) {
	m.Title = "Reel do Instagram"
	if m.Kind != "reel" {
		m.Title = "Vídeo do Instagram"
	}
	res, err := r.f.Get(ctx, r.instagramPage(m.CanonicalURL))
	if err != nil {
		return
	}
	switch res.Status {
	case http.StatusOK:
	case http.StatusNotFound:
		m.Health = HealthDead
		return
	default:
		return
	}
	body := string(res.Body)
	t := ogTitleRe.FindStringSubmatch(body)
	if t == nil {
		return // a login wall or an interstitial, not the post
	}
	m.Health = HealthAlive
	if title := clean(html.UnescapeString(firstGroup(t)), maxTitle); title != "" {
		m.Title = title
	}
	if i := ogImageRe.FindStringSubmatch(body); i != nil {
		img := html.UnescapeString(firstGroup(i))
		if hostHasSuffix(img, "cdninstagram.com", "fbcdn.net") {
			m.Thumbnail = img
		}
	}
}

// defaultExpand follows a TikTok short link through the hardened fetch client.
func defaultExpand(f *fetch.Client) func(context.Context, string) (string, bool) {
	return func(ctx context.Context, short string) (string, bool) {
		res, err := f.Get(ctx, short)
		if err != nil || res.URL == "" {
			return "", false
		}
		return res.URL, true
	}
}

func hostHasSuffix(raw string, suffixes ...string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" {
		return false
	}
	h := u.Hostname()
	for _, s := range suffixes {
		if h == s || strings.HasSuffix(h, "."+s) {
			return true
		}
	}
	return false
}
