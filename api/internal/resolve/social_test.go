package resolve

import (
	"context"
	"net/http"
	"testing"
)

func TestTikTokOEmbedMapsToMetaAndHealth(t *testing.T) {
	r, _, base := newResolver(t, func(w http.ResponseWriter, req *http.Request) {
		if got := req.URL.Query().Get("url"); got != "https://www.tiktok.com/@u/video/7234567890123456789" {
			t.Errorf("oembed url param = %q", got)
		}
		w.Write([]byte(`{"title":"Receita rápida","author_name":"Chef U","thumbnail_url":"https://p16-sign.tiktokcdn-us.com/obj/x.jpg"}`))
	})
	r.tiktokOEmbed = base + "/oembed"
	m, err := r.Resolve(context.Background(), "https://www.tiktok.com/@u/video/7234567890123456789")
	if err != nil {
		t.Fatal(err)
	}
	if m.Title != "Receita rápida" || m.Author != "Chef U" || m.Health != HealthAlive {
		t.Fatalf("got %+v", m)
	}
	if m.Thumbnail != "https://p16-sign.tiktokcdn-us.com/obj/x.jpg" {
		t.Errorf("thumbnail = %q", m.Thumbnail)
	}
}

func TestTikTokStatusAndForeignThumbnail(t *testing.T) {
	cases := map[int]string{400: HealthDead, 404: HealthDead, 500: HealthUnknown, 429: HealthUnknown}
	for status, want := range cases {
		r, _, base := newResolver(t, func(w http.ResponseWriter, req *http.Request) { w.WriteHeader(status) })
		r.tiktokOEmbed = base + "/oembed"
		m, err := r.Resolve(context.Background(), "https://www.tiktok.com/@u/video/7234567890123456789")
		if err != nil {
			t.Fatal(err)
		}
		if m.Health != want {
			t.Errorf("status %d → %q, want %q", status, m.Health, want)
		}
		if m.Title == "" {
			t.Errorf("status %d: fallback title missing", status)
		}
	}
	r, _, base := newResolver(t, func(w http.ResponseWriter, req *http.Request) {
		w.Write([]byte(`{"title":"x","thumbnail_url":"http://evil.example/x.jpg"}`))
	})
	r.tiktokOEmbed = base + "/oembed"
	m, _ := r.Resolve(context.Background(), "https://www.tiktok.com/@u/video/7234567890123456789")
	if m.Thumbnail != "" {
		t.Errorf("foreign thumbnail kept: %q", m.Thumbnail)
	}
}

func TestTikTokShortLinkIsExpandedThenResolved(t *testing.T) {
	r, _, base := newResolver(t, func(w http.ResponseWriter, req *http.Request) { w.Write([]byte(`{"title":"Curto"}`)) })
	r.tiktokOEmbed = base + "/oembed"
	r.expand = func(ctx context.Context, raw string) (string, bool) {
		if raw != "https://vm.tiktok.com/ZMabc123/" {
			t.Errorf("expand got %q", raw)
		}
		return "https://www.tiktok.com/@u/video/7234567890123456789?_r=1", true
	}
	m, err := r.Resolve(context.Background(), "https://vm.tiktok.com/ZMabc123/")
	if err != nil {
		t.Fatal(err)
	}
	if m.ID != "7234567890123456789" || m.Title != "Curto" {
		t.Fatalf("got %+v", m)
	}
}

func TestTikTokShortLinkThatCannotBeExpandedIsUnsupported(t *testing.T) {
	r, _, _ := newResolver(t, func(w http.ResponseWriter, req *http.Request) {})
	r.expand = func(ctx context.Context, raw string) (string, bool) { return "", false }
	if _, err := r.Resolve(context.Background(), "https://vm.tiktok.com/ZMabc123/"); err == nil {
		t.Fatal("want an error for a short link that does not expand")
	}
}

func TestInstagramOpenGraphGivesTitleAndThumbnail(t *testing.T) {
	r, _, base := newResolver(t, func(w http.ResponseWriter, req *http.Request) {
		w.Write([]byte(`<html><head><meta property="og:title" content="Casa Aberta on Instagram: &quot;Sessão&quot;"/><meta content="https://scontent.cdninstagram.com/v/t/x.jpg" property="og:image"/></head></html>`))
	})
	r.instagramPage = func(canonical string) string { return base + "/page" }
	m, err := r.Resolve(context.Background(), "https://www.instagram.com/reel/Cxyz123/")
	if err != nil {
		t.Fatal(err)
	}
	if m.Health != HealthAlive || m.Title != `Casa Aberta on Instagram: "Sessão"` {
		t.Fatalf("got %+v", m)
	}
	if m.Thumbnail != "https://scontent.cdninstagram.com/v/t/x.jpg" {
		t.Errorf("thumbnail = %q", m.Thumbnail)
	}
}

func TestInstagramLoginWallIsUnknownNeverDead(t *testing.T) {
	r, _, base := newResolver(t, func(w http.ResponseWriter, req *http.Request) {
		w.Write([]byte(`<html><head><title>Login • Instagram</title></head><body>Log in</body></html>`))
	})
	r.instagramPage = func(string) string { return base + "/page" }
	m, _ := r.Resolve(context.Background(), "https://www.instagram.com/reel/Cxyz123/")
	if m.Health != HealthUnknown || m.Title != "Reel do Instagram" {
		t.Fatalf("got %+v", m)
	}
}

func TestInstagramStatusMapping(t *testing.T) {
	cases := map[int]string{404: HealthDead, 429: HealthUnknown, 500: HealthUnknown, 302: HealthUnknown}
	for status, want := range cases {
		r, _, base := newResolver(t, func(w http.ResponseWriter, req *http.Request) { w.WriteHeader(status) })
		r.instagramPage = func(string) string { return base + "/page" }
		m, _ := r.Resolve(context.Background(), "https://www.instagram.com/reel/Cxyz123/")
		if m.Health != want {
			t.Errorf("status %d → %q, want %q", status, m.Health, want)
		}
	}
}

func TestInstagramRejectsForeignThumbnail(t *testing.T) {
	r, _, base := newResolver(t, func(w http.ResponseWriter, req *http.Request) {
		w.Write([]byte(`<meta property="og:title" content="t"><meta property="og:image" content="https://evil.example/x.jpg">`))
	})
	r.instagramPage = func(string) string { return base + "/page" }
	m, _ := r.Resolve(context.Background(), "https://www.instagram.com/reel/Cxyz123/")
	if m.Thumbnail != "" {
		t.Errorf("foreign thumbnail kept: %q", m.Thumbnail)
	}
}

func TestHLSPlaylistUsesHead(t *testing.T) {
	r, _, base := newResolver(t, func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodHead {
			t.Errorf("method = %s, want HEAD", req.Method)
		}
	})
	m, err := r.Resolve(context.Background(), base+"/live/stream.m3u8")
	if err != nil {
		t.Fatal(err)
	}
	if m.Health != HealthAlive || m.Kind != "hls" {
		t.Fatalf("got %+v", m)
	}
}
