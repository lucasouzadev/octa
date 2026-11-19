package resolve

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/lucasouzadev/octa/api/internal/fetch"
	"github.com/lucasouzadev/octa/api/internal/provider"
)

var fixedNow = time.Date(2026, 11, 19, 12, 0, 0, 0, time.UTC)

func newResolver(t *testing.T, h http.HandlerFunc) (*Resolver, *atomic.Int32, string) {
	t.Helper()
	var hits atomic.Int32
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		h(w, r)
	}))
	t.Cleanup(s.Close)
	r := New(fetch.NewForTests(fetch.Options{}), func() time.Time { return fixedNow })
	r.youtubeOEmbed = s.URL + "/oembed"
	return r, &hits, s.URL
}

func TestYouTubeAliveUsesOEmbed(t *testing.T) {
	r, _, _ := newResolver(t, func(w http.ResponseWriter, req *http.Request) {
		if got := req.URL.Query().Get("url"); got != "https://www.youtube.com/watch?v=dQw4w9WgXcQ" {
			t.Errorf("oembed url param = %q", got)
		}
		w.Write([]byte(`{"title":"Sessão ao vivo","author_name":"Casa Aberta","thumbnail_url":"https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"}`))
	})
	m, err := r.Resolve(context.Background(), "https://youtu.be/dQw4w9WgXcQ")
	if err != nil {
		t.Fatal(err)
	}
	if m.Title != "Sessão ao vivo" || m.Author != "Casa Aberta" || m.Health != HealthAlive {
		t.Fatalf("got %+v", m)
	}
	if m.Thumbnail != "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" || !m.CheckedAt.Equal(fixedNow) {
		t.Fatalf("got %+v", m)
	}
}

func TestYouTubeStatusMapsToHealth(t *testing.T) {
	cases := map[int]string{401: HealthRestricted, 403: HealthRestricted, 404: HealthDead, 500: HealthUnknown}
	for status, want := range cases {
		r, _, _ := newResolver(t, func(w http.ResponseWriter, req *http.Request) { w.WriteHeader(status) })
		m, err := r.Resolve(context.Background(), "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
		if err != nil {
			t.Fatal(err)
		}
		if m.Health != want {
			t.Errorf("status %d → health %q, want %q", status, m.Health, want)
		}
		if m.Thumbnail != "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" || m.Title == "" {
			t.Errorf("status %d: fallback title/thumb missing: %+v", status, m)
		}
	}
}

func TestYouTubeRejectsForeignThumbnailAndCapsTitle(t *testing.T) {
	long := make([]byte, 1000)
	for i := range long {
		long[i] = 'a'
	}
	r, _, _ := newResolver(t, func(w http.ResponseWriter, req *http.Request) {
		w.Write([]byte(`{"title":"` + string(long) + `","thumbnail_url":"http://evil.example/x.jpg"}`))
	})
	m, err := r.Resolve(context.Background(), "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
	if err != nil {
		t.Fatal(err)
	}
	if m.Thumbnail != "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" {
		t.Errorf("thumbnail = %q, want ytimg fallback", m.Thumbnail)
	}
	if n := len([]rune(m.Title)); n > maxTitle {
		t.Errorf("title length = %d, want ≤ %d", n, maxTitle)
	}
}

func TestResolveIsCached(t *testing.T) {
	r, hits, _ := newResolver(t, func(w http.ResponseWriter, req *http.Request) {
		w.Write([]byte(`{"title":"x"}`))
	})
	for i := 0; i < 3; i++ {
		if _, err := r.Resolve(context.Background(), "https://www.youtube.com/watch?v=dQw4w9WgXcQ"); err != nil {
			t.Fatal(err)
		}
	}
	if hits.Load() != 1 {
		t.Fatalf("upstream hits = %d, want 1", hits.Load())
	}
}

func TestDirectFileHealthFromHead(t *testing.T) {
	cases := map[int]string{200: HealthAlive, 206: HealthAlive, 404: HealthDead, 410: HealthDead, 403: HealthRestricted, 500: HealthUnknown}
	for status, want := range cases {
		r, _, base := newResolver(t, func(w http.ResponseWriter, req *http.Request) {
			if req.Method != http.MethodHead {
				t.Errorf("method = %s, want HEAD", req.Method)
			}
			w.WriteHeader(status)
		})
		m, err := r.Resolve(context.Background(), base+"/media/Ensaio%20aberto.mp4")
		if err != nil {
			t.Fatal(err)
		}
		if m.Health != want || m.Title != "Ensaio aberto" || m.Embed.Type != "video" {
			t.Errorf("status %d → %+v, want health %q", status, m, want)
		}
	}
}

func TestDirectFileOnPrivateHostIsUnknownNotFetched(t *testing.T) {
	r := New(fetch.New(fetch.Options{}), func() time.Time { return fixedNow })
	m, err := r.Resolve(context.Background(), "http://127.0.0.1:9/secret.mp4")
	if err != nil {
		t.Fatal(err)
	}
	if m.Health != HealthUnknown {
		t.Fatalf("health = %q, want unknown (blocked)", m.Health)
	}
}

func TestUnsupportedPassesParserError(t *testing.T) {
	r := New(fetch.New(fetch.Options{}), time.Now)
	if _, err := r.Resolve(context.Background(), "https://example.com/page"); !errors.Is(err, provider.ErrUnsupported) {
		t.Fatalf("err = %v, want ErrUnsupported", err)
	}
}

func TestCheckFreshBypassesCache(t *testing.T) {
	r, hits, _ := newResolver(t, func(w http.ResponseWriter, req *http.Request) { w.Write([]byte(`{"title":"x"}`)) })
	ctx := context.Background()
	const u = "https://youtu.be/dQw4w9WgXcQ"
	if _, err := r.Check(ctx, u, false); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Check(ctx, u, false); err != nil {
		t.Fatal(err)
	}
	if hits.Load() != 1 {
		t.Fatalf("cached check hit upstream %d times, want 1", hits.Load())
	}
	if _, err := r.Check(ctx, u, true); err != nil {
		t.Fatal(err)
	}
	if hits.Load() != 2 {
		t.Fatalf("fresh check hit upstream %d times in total, want 2", hits.Load())
	}
}

func TestCheckReportsParserErrors(t *testing.T) {
	r, _, _ := newResolver(t, func(w http.ResponseWriter, req *http.Request) {})
	if _, err := r.Check(context.Background(), "ftp://x", false); !errors.Is(err, provider.ErrInvalid) && !errors.Is(err, provider.ErrUnsupported) {
		t.Fatalf("err = %v, want invalid or unsupported", err)
	}
}
