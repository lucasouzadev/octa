package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/lucasouzadev/octa/api/internal/provider"
	"github.com/lucasouzadev/octa/api/internal/resolve"
)

type fakeResolver struct{}

func (fakeResolver) Resolve(_ context.Context, raw string) (resolve.Meta, error) {
	ref, err := provider.Parse(raw)
	if err != nil {
		return resolve.Meta{}, err
	}
	return resolve.Meta{Ref: ref, Health: resolve.HealthAlive}, nil
}

func newHandler(t *testing.T, burst int) http.Handler {
	t.Helper()
	return New(Config{
		Resolver:       fakeResolver{},
		AllowedOrigins: []string{"https://octa.app", "http://localhost:5173"},
		RatePerMinute:  60,
		Burst:          burst,
	})
}

func post(h http.Handler, body string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/v1/resolve", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func errorCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var e struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &e); err != nil {
		t.Fatalf("body %q is not an error JSON: %v", rec.Body.String(), err)
	}
	return e.Error
}

func TestResolveReturnsMeta(t *testing.T) {
	rec := post(newHandler(t, 10), `{"url":"https://youtu.be/dQw4w9WgXcQ"}`, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body)
	}
	var m resolve.Meta
	if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil {
		t.Fatal(err)
	}
	if m.Source != "youtube" || m.ID != "dQw4w9WgXcQ" || m.Embed.Type != "iframe" {
		t.Fatalf("got %+v", m)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Errorf("Content-Type = %q", ct)
	}
	if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Error("missing nosniff")
	}
}

func TestResolveErrors(t *testing.T) {
	cases := []struct {
		name, body string
		status     int
		code       string
	}{
		{"unsupported", `{"url":"https://example.com/page"}`, 422, "unsupported_url"},
		{"invalid", `{"url":"javascript:alert(1)"}`, 422, "invalid_url"},
		{"missing url", `{}`, 422, "invalid_url"},
		{"bad json", `{"url":`, 400, "bad_request"},
		{"too large", `{"url":"` + strings.Repeat("a", 20_000) + `"}`, 413, "too_large"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := post(newHandler(t, 10), c.body, nil)
			if rec.Code != c.status || errorCode(t, rec) != c.code {
				t.Fatalf("got %d %s, want %d %s", rec.Code, rec.Body, c.status, c.code)
			}
		})
	}
}

func TestResolveRejectsWrongMethod(t *testing.T) {
	rec := httptest.NewRecorder()
	newHandler(t, 10).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/resolve", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestCORSAllowsConfiguredOriginOnly(t *testing.T) {
	h := newHandler(t, 10)

	req := httptest.NewRequest(http.MethodOptions, "/v1/resolve", nil)
	req.Header.Set("Origin", "https://octa.app")
	req.Header.Set("Access-Control-Request-Method", "POST")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent || rec.Header().Get("Access-Control-Allow-Origin") != "https://octa.app" {
		t.Fatalf("preflight: %d ACAO=%q", rec.Code, rec.Header().Get("Access-Control-Allow-Origin"))
	}

	rec = post(h, `{"url":"https://youtu.be/dQw4w9WgXcQ"}`, map[string]string{"Origin": "https://evil.example"})
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("ACAO for foreign origin = %q, want empty", got)
	}
}

func TestRateLimitPerIP(t *testing.T) {
	h := newHandler(t, 2)
	codes := []int{}
	for i := 0; i < 3; i++ {
		codes = append(codes, post(h, `{"url":"https://youtu.be/dQw4w9WgXcQ"}`, nil).Code)
	}
	if codes[0] != 200 || codes[1] != 200 || codes[2] != http.StatusTooManyRequests {
		t.Fatalf("codes = %v, want [200 200 429]", codes)
	}
}

func TestHealthz(t *testing.T) {
	rec := httptest.NewRecorder()
	newHandler(t, 10).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != "ok" {
		t.Fatalf("got %d %q", rec.Code, rec.Body)
	}
}

func TestSweepDropsIdleLimiters(t *testing.T) {
	s := New(Config{Resolver: fakeResolver{}, Burst: 1})
	post(s, `{"url":"https://youtu.be/dQw4w9WgXcQ"}`, nil)
	if post(s, `{"url":"https://youtu.be/dQw4w9WgXcQ"}`, nil).Code != http.StatusTooManyRequests {
		t.Fatal("expected limiter to be exhausted")
	}
	s.Sweep(-time.Second) // everything counts as idle
	if code := post(s, `{"url":"https://youtu.be/dQw4w9WgXcQ"}`, nil).Code; code != http.StatusOK {
		t.Fatalf("after sweep status = %d, want 200", code)
	}
}
