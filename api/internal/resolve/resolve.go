// Package resolve turns a pasted link into playable metadata: parser result,
// title/author/thumbnail from the platform, and whether the link is alive.
// Upstream failures never fail the request: the parser result is returned
// with health "unknown" so the web app can still save and play the link.
package resolve

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/lucasouzadev/octa/api/internal/cache"
	"github.com/lucasouzadev/octa/api/internal/fetch"
	"github.com/lucasouzadev/octa/api/internal/provider"
)

const (
	HealthAlive      = "alive"
	HealthDead       = "dead"
	HealthRestricted = "restricted"
	HealthUnknown    = "unknown"

	maxTitle  = 300
	maxAuthor = 120

	ttlAlive = 6 * time.Hour
	ttlOther = 1 * time.Hour
)

// Meta is the /v1/resolve response body.
type Meta struct {
	provider.Ref
	Author      string    `json:"author,omitempty"`
	Thumbnail   string    `json:"thumbnail,omitempty"`
	DurationSec *int      `json:"durationSec"`
	Health      string    `json:"health"`
	CheckedAt   time.Time `json:"checkedAt"`
}

type Resolver struct {
	f             *fetch.Client
	cache         *cache.TTL[string, Meta]
	now           func() time.Time
	youtubeOEmbed string
	tiktokOEmbed  string
	// instagramPage maps a canonical post URL to the page that is fetched (tests only).
	instagramPage func(canonical string) string
	// expand follows a TikTok short link to its /@user/video/ID URL.
	expand func(ctx context.Context, short string) (string, bool)
}

func New(f *fetch.Client, now func() time.Time) *Resolver {
	return &Resolver{
		f:             f,
		cache:         cache.New[string, Meta](10_000, now),
		now:           now,
		youtubeOEmbed: "https://www.youtube.com/oembed",
		tiktokOEmbed:  "https://www.tiktok.com/oembed",
		instagramPage: func(canonical string) string { return canonical },
		expand:        defaultExpand(f),
	}
}

// Resolve returns provider.ErrInvalid / ErrUnsupported for bad input; every
// other outcome is a Meta (possibly with health "unknown").
func (r *Resolver) Resolve(ctx context.Context, raw string) (Meta, error) {
	return r.Check(ctx, raw, false)
}

// Check is Resolve with an option to skip the cache: fresh=true asks the
// platform again (used when the person re-checks a link that looked dead).
func (r *Resolver) Check(ctx context.Context, raw string, fresh bool) (Meta, error) {
	if short, ok := provider.ShortTikTokURL(raw); ok {
		exp, ok := r.expand(ctx, short)
		if !ok {
			return Meta{}, provider.ErrUnsupported
		}
		raw = exp
	}
	ref, err := provider.Parse(raw)
	if err != nil {
		return Meta{}, err
	}
	if fresh {
		r.cache.Delete(ref.CanonicalURL)
	} else if m, ok := r.cache.Get(ref.CanonicalURL); ok {
		return m, nil
	}
	m := Meta{Ref: ref, Health: HealthUnknown, CheckedAt: r.now()}
	switch ref.Source {
	case "youtube":
		r.youtube(ctx, &m)
	case "tiktok":
		r.tiktok(ctx, &m)
	case "instagram":
		r.instagram(ctx, &m)
	case "direct":
		r.direct(ctx, &m)
	}
	ttl := ttlOther
	if m.Health == HealthAlive {
		ttl = ttlAlive
	}
	r.cache.Set(ref.CanonicalURL, m, ttl)
	return m, nil
}

func (r *Resolver) youtube(ctx context.Context, m *Meta) {
	m.Title = "Vídeo do YouTube"
	m.Thumbnail = "https://i.ytimg.com/vi/" + m.ID + "/hqdefault.jpg"

	q := url.Values{"format": {"json"}, "url": {m.CanonicalURL}}
	res, err := r.f.Get(ctx, r.youtubeOEmbed+"?"+q.Encode())
	if err != nil {
		return
	}
	switch {
	case res.Status == http.StatusOK:
		m.Health = HealthAlive
	case res.Status == http.StatusUnauthorized || res.Status == http.StatusForbidden:
		m.Health = HealthRestricted
		return
	case res.Status == http.StatusNotFound:
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
	if isYouTubeImage(o.ThumbnailURL) {
		m.Thumbnail = o.ThumbnailURL
	}
}

func (r *Resolver) direct(ctx context.Context, m *Meta) {
	res, err := r.f.Head(ctx, m.CanonicalURL)
	if err != nil {
		return
	}
	switch s := res.Status; {
	case s >= 200 && s < 300:
		m.Health = HealthAlive
	case s == http.StatusNotFound || s == http.StatusGone:
		m.Health = HealthDead
	case s == http.StatusUnauthorized || s == http.StatusForbidden:
		m.Health = HealthRestricted
	}
}

func isYouTubeImage(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" {
		return false
	}
	h := u.Hostname()
	return h == "i.ytimg.com" || strings.HasSuffix(h, ".ytimg.com")
}

// clean trims, drops control characters and caps length in runes. Upstream
// text is rendered as text by the web app, never as HTML.
func clean(s string, max int) string {
	s = strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f {
			return ' '
		}
		return r
	}, strings.TrimSpace(s))
	if rs := []rune(s); len(rs) > max {
		s = strings.TrimSpace(string(rs[:max-1])) + "…"
	}
	return s
}
