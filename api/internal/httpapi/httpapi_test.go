package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync/atomic"
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

func (f fakeResolver) Check(ctx context.Context, raw string, _ bool) (resolve.Meta, error) {
	return f.Resolve(ctx, raw)
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

func newHandlerWithIPHeader(header string, burst int) http.Handler {
	return New(Config{
		Resolver:       fakeResolver{},
		RatePerMinute:  60,
		Burst:          burst,
		ClientIPHeader: header,
	})
}

const okBody = `{"url":"https://youtu.be/dQw4w9WgXcQ"}`

func TestClientIPHeaderSeparatesBuckets(t *testing.T) {
	h := newHandlerWithIPHeader("True-Client-IP", 1)
	a := map[string]string{"True-Client-IP": "203.0.113.7"}
	b := map[string]string{"True-Client-IP": "203.0.113.8"}
	codes := []int{post(h, okBody, a).Code, post(h, okBody, b).Code, post(h, okBody, a).Code}
	if codes[0] != 200 || codes[1] != 200 || codes[2] != http.StatusTooManyRequests {
		t.Fatalf("codes = %v, want [200 200 429]", codes)
	}
}

func TestClientIPHeaderIgnoredWhenNotConfigured(t *testing.T) {
	h := newHandlerWithIPHeader("", 1)
	first := post(h, okBody, map[string]string{"True-Client-IP": "203.0.113.7"}).Code
	second := post(h, okBody, map[string]string{"True-Client-IP": "203.0.113.8"}).Code
	if first != 200 || second != http.StatusTooManyRequests {
		t.Fatalf("codes = [%d %d], want [200 429]: a spoofed header must not change the bucket", first, second)
	}
}

func TestClientIPHeaderInvalidValueFallsBackToRemoteAddr(t *testing.T) {
	h := newHandlerWithIPHeader("True-Client-IP", 1)
	for i, v := range []string{"", "not-an-ip", "203.0.113.7, 198.51.100.1", "999.1.1.1"} {
		hdr := map[string]string{}
		if v != "" {
			hdr["True-Client-IP"] = v
		}
		code := post(h, okBody, hdr).Code
		want := 200
		if i > 0 {
			want = http.StatusTooManyRequests // all share the RemoteAddr bucket
		}
		if code != want {
			t.Fatalf("value %q: status = %d, want %d", v, code, want)
		}
	}
}

func TestClientIPHeaderNormalizesValue(t *testing.T) {
	h := newHandlerWithIPHeader("True-Client-IP", 1)
	first := post(h, okBody, map[string]string{"True-Client-IP": "2001:db8::1"}).Code
	second := post(h, okBody, map[string]string{"True-Client-IP": " 2001:0db8:0:0:0:0:0:1 "}).Code
	if first != 200 || second != http.StatusTooManyRequests {
		t.Fatalf("codes = [%d %d], want [200 429]: equivalent IPs share one bucket", first, second)
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

// --- POST /v1/health ---

type healthOut struct {
	Results []struct {
		ID        string `json:"id"`
		Health    string `json:"health"`
		CheckedAt string `json:"checkedAt"`
	} `json:"results"`
}

func postHealth(h http.Handler, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/v1/health", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHealthBatchKeepsOrderAndIDs(t *testing.T) {
	h := newHandler(t, 10)
	rec := postHealth(h, `{"items":[{"id":"b","url":"https://youtu.be/dQw4w9WgXcQ"},{"id":"a","url":"https://youtu.be/aaaaaaaaaaa"}]}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body)
	}
	var out healthOut
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if len(out.Results) != 2 || out.Results[0].ID != "b" || out.Results[1].ID != "a" || out.Results[0].Health != "alive" {
		t.Fatalf("got %+v", out.Results)
	}
	if strings.Contains(rec.Body.String(), "youtu") {
		t.Fatal("response must not echo the URLs")
	}
}

func TestHealthBadItemIsUnknownNotAnError(t *testing.T) {
	h := newHandler(t, 10)
	rec := postHealth(h, `{"items":[{"id":"x","url":"not a url"},{"id":"y","url":"https://youtu.be/dQw4w9WgXcQ"}]}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var out healthOut
	json.Unmarshal(rec.Body.Bytes(), &out)
	if out.Results[0].Health != "unknown" || out.Results[1].Health != "alive" {
		t.Fatalf("got %+v", out.Results)
	}
}

func TestHealthRejectsEmptyAndOversizedBatches(t *testing.T) {
	h := newHandler(t, 10)
	if rec := postHealth(h, `{"items":[]}`); rec.Code != http.StatusBadRequest {
		t.Fatalf("empty: status = %d, want 400", rec.Code)
	}
	if rec := postHealth(h, `nope`); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad json: status = %d, want 400", rec.Code)
	}
	var b strings.Builder
	b.WriteString(`{"items":[`)
	for i := 0; i < 51; i++ {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString(`{"id":"i","url":"https://youtu.be/dQw4w9WgXcQ"}`)
	}
	b.WriteString(`]}`)
	rec := postHealth(h, b.String())
	if rec.Code != http.StatusRequestEntityTooLarge || errorCode(t, rec) != "too_large" {
		t.Fatalf("51 items: status = %d body=%s, want 413 too_large", rec.Code, rec.Body)
	}
}

type slowResolver struct {
	fakeResolver
	cur, max atomic.Int32
}

func (s *slowResolver) Check(ctx context.Context, raw string, fresh bool) (resolve.Meta, error) {
	n := s.cur.Add(1)
	defer s.cur.Add(-1)
	for {
		m := s.max.Load()
		if n <= m || s.max.CompareAndSwap(m, n) {
			break
		}
	}
	time.Sleep(15 * time.Millisecond)
	return s.fakeResolver.Resolve(ctx, raw)
}

func TestHealthBoundsOutboundConcurrency(t *testing.T) {
	res := &slowResolver{}
	h := New(Config{Resolver: res, AllowedOrigins: []string{"https://octa.app"}, Burst: 10})
	var b strings.Builder
	b.WriteString(`{"items":[`)
	for i := 0; i < 50; i++ {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString(`{"id":"i` + strconv.Itoa(i) + `","url":"https://youtu.be/dQw4w9WgXcQ"}`)
	}
	b.WriteString(`]}`)
	if rec := postHealth(h, b.String()); rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := res.max.Load(); got > 16 || got < 2 {
		t.Fatalf("max concurrent checks = %d, want 2..16", got)
	}
}

func TestHealthIsRateLimitedLikeResolve(t *testing.T) {
	h := newHandler(t, 1)
	body := `{"items":[{"id":"a","url":"https://youtu.be/dQw4w9WgXcQ"}]}`
	if postHealth(h, body).Code != http.StatusOK {
		t.Fatal("first call should pass")
	}
	if postHealth(h, body).Code != http.StatusTooManyRequests {
		t.Fatal("second call should be limited")
	}
}
