// Package httpapi exposes the API over HTTP: routing, JSON, CORS, per-IP rate
// limiting and request logging. Business logic lives in package resolve.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"slices"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"github.com/lucasouzadev/octa/api/internal/provider"
	"github.com/lucasouzadev/octa/api/internal/resolve"
)

const (
	maxBodyBytes       = 8 << 10   // 8 KB is plenty for one URL
	maxHealthBodyBytes = 160 << 10 // 50 items x (2048-byte URL + id)
	maxHealthItems     = 50
	maxHealthParallel  = 16 // outbound checks at once (ARCHITECTURE §6)
	maxURLLen          = 2048
)

type Resolver interface {
	Resolve(ctx context.Context, raw string) (resolve.Meta, error)
	Check(ctx context.Context, raw string, fresh bool) (resolve.Meta, error)
}

type Config struct {
	Resolver       Resolver
	AllowedOrigins []string
	RatePerMinute  int // sustained requests per IP; default 30
	Burst          int // default 10
	Logger         *slog.Logger
	// ClientIPHeader names a request header that carries the real client IP and
	// is set by a proxy the operator trusts (e.g. True-Client-IP on Render).
	// Empty means "trust nothing": the limiter keys on RemoteAddr. Never point
	// this at a header the client can write (X-Forwarded-For on Render appends
	// to whatever the client sent, so its first entry is forgeable).
	ClientIPHeader string
}

// Server is the API's http.Handler.
type Server struct {
	cfg      Config
	limiters sync.Map // ip -> *visitor
	h        http.Handler
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) { s.h.ServeHTTP(w, r) }

type visitor struct {
	lim      *rate.Limiter
	lastSeen time.Time
	mu       sync.Mutex
}

func New(cfg Config) *Server {
	if cfg.RatePerMinute <= 0 {
		cfg.RatePerMinute = 30
	}
	if cfg.Burst <= 0 {
		cfg.Burst = 10
	}
	if cfg.Logger == nil {
		cfg.Logger = slog.Default()
	}
	s := &Server{cfg: cfg}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Write([]byte("ok\n"))
	})
	mux.HandleFunc("POST /v1/resolve", s.limit(s.resolve))
	mux.HandleFunc("POST /v1/health", s.limit(s.health))
	mux.HandleFunc("OPTIONS /v1/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	s.h = s.log(s.cors(mux))
	return s
}

func (s *Server) resolve(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	var in struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeError(w, http.StatusRequestEntityTooLarge, "too_large")
			return
		}
		writeError(w, http.StatusBadRequest, "bad_request")
		return
	}
	m, err := s.cfg.Resolver.Resolve(r.Context(), in.URL)
	switch {
	case errors.Is(err, provider.ErrInvalid):
		writeError(w, http.StatusUnprocessableEntity, "invalid_url")
	case errors.Is(err, provider.ErrUnsupported):
		writeError(w, http.StatusUnprocessableEntity, "unsupported_url")
	case err != nil:
		writeError(w, http.StatusInternalServerError, "internal")
	default:
		writeJSON(w, http.StatusOK, m)
	}
}

type healthItem struct {
	ID  string `json:"id"`
	URL string `json:"url"`
}

type healthResult struct {
	ID        string    `json:"id"`
	Health    string    `json:"health"`
	CheckedAt time.Time `json:"checkedAt"`
}

// health checks up to 50 links at once, at most 16 upstream requests in
// flight. A link that cannot be parsed or reached is "unknown", never an error
// for the batch. Results carry the caller's id only, never the URL.
func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxHealthBodyBytes)
	var in struct {
		Items []healthItem `json:"items"`
		Fresh bool         `json:"fresh"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeError(w, http.StatusRequestEntityTooLarge, "too_large")
			return
		}
		writeError(w, http.StatusBadRequest, "bad_request")
		return
	}
	if len(in.Items) == 0 {
		writeError(w, http.StatusBadRequest, "bad_request")
		return
	}
	if len(in.Items) > maxHealthItems {
		writeError(w, http.StatusRequestEntityTooLarge, "too_large")
		return
	}
	out := make([]healthResult, len(in.Items))
	sem := make(chan struct{}, maxHealthParallel)
	var wg sync.WaitGroup
	for i, it := range in.Items {
		out[i] = healthResult{ID: it.ID, Health: resolve.HealthUnknown, CheckedAt: time.Now().UTC()}
		if len(it.URL) > maxURLLen {
			continue
		}
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			if m, err := s.cfg.Resolver.Check(r.Context(), it.URL, in.Fresh); err == nil {
				out[i].Health, out[i].CheckedAt = m.Health, m.CheckedAt
			}
		}()
	}
	wg.Wait()
	writeJSON(w, http.StatusOK, map[string]any{"results": out})
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		w.Header().Add("Vary", "Origin")
		if origin != "" && slices.Contains(s.cfg.AllowedOrigins, origin) {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Methods", "POST, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Content-Type")
			h.Set("Access-Control-Max-Age", "600")
		}
		next.ServeHTTP(w, r)
	})
}

// limit applies a token bucket per client IP (see clientIP).
func (s *Server) limit(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		v := s.visitor(s.clientIP(r))
		if !v.lim.Allow() {
			w.Header().Set("Retry-After", "10")
			writeError(w, http.StatusTooManyRequests, "rate_limited")
			return
		}
		next(w, r)
	}
}

// clientIP returns the rate-limit key. It reads cfg.ClientIPHeader only when the
// operator configured one and the value is a single valid IP; anything else
// (missing, junk, a list) falls back to RemoteAddr so a bad header can never
// mint a fresh bucket.
func (s *Server) clientIP(r *http.Request) string {
	if h := s.cfg.ClientIPHeader; h != "" {
		if addr, err := netip.ParseAddr(strings.TrimSpace(r.Header.Get(h))); err == nil {
			return addr.Unmap().String()
		}
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

func (s *Server) visitor(ip string) *visitor {
	now := time.Now()
	val, _ := s.limiters.LoadOrStore(ip, &visitor{
		lim: rate.NewLimiter(rate.Limit(float64(s.cfg.RatePerMinute)/60), s.cfg.Burst),
	})
	v := val.(*visitor)
	v.mu.Lock()
	v.lastSeen = now
	v.mu.Unlock()
	return v
}

// Sweep drops rate limiters idle for longer than idle. main runs it on a ticker.
func (s *Server) Sweep(idle time.Duration) {
	cutoff := time.Now().Add(-idle)
	s.limiters.Range(func(k, val any) bool {
		v := val.(*visitor)
		v.mu.Lock()
		stale := v.lastSeen.Before(cutoff)
		v.mu.Unlock()
		if stale {
			s.limiters.Delete(k)
		}
		return true
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// log records method, route, status and latency — never the pasted URL.
func (s *Server) log(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(rec, r)
		s.cfg.Logger.Info("request", "method", r.Method, "path", r.URL.Path, "status", rec.status, "ms", time.Since(start).Milliseconds())
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}
