package fetch

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"testing"
	"time"
)

func TestIsPublic(t *testing.T) {
	cases := map[string]bool{
		"8.8.8.8":            true,
		"142.250.79.14":      true,
		"2606:4700::1111":    true,
		"127.0.0.1":          false,
		"10.1.2.3":           false,
		"172.16.0.1":         false,
		"192.168.1.1":        false,
		"169.254.169.254":    false, // cloud metadata
		"100.64.0.1":         false, // CGNAT
		"0.0.0.0":            false,
		"224.0.0.1":          false,
		"198.18.0.1":         false,
		"::1":                false,
		"fe80::1":            false,
		"fd00:ec2::254":      false, // ULA (AWS IMDS v6)
		"::ffff:127.0.0.1":   false, // v4-mapped loopback
		"::ffff:8.8.8.8":     true,
		"64:ff9b::a9fe:a9fe": false, // NAT64 of 169.254.169.254
		"255.255.255.255":    false,
	}
	for s, want := range cases {
		if got := isPublic(netip.MustParseAddr(s)); got != want {
			t.Errorf("isPublic(%s) = %v, want %v", s, got, want)
		}
	}
}

func newServer(t *testing.T, h http.HandlerFunc) *httptest.Server {
	t.Helper()
	s := httptest.NewServer(h)
	t.Cleanup(s.Close)
	return s
}

func TestBlocksLoopbackByDefault(t *testing.T) {
	s := newServer(t, func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("secret")) })
	_, err := New(Options{}).Get(context.Background(), s.URL)
	if !errors.Is(err, ErrBlocked) {
		t.Fatalf("err = %v, want ErrBlocked", err)
	}
}

func TestGetReturnsBodyWhenAllowed(t *testing.T) {
	s := newServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Cookie") != "" {
			t.Error("client must not send cookies")
		}
		w.Write([]byte(`{"ok":true}`))
	})
	res, err := New(Options{allowLoopback: true}).Get(context.Background(), s.URL)
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != 200 || string(res.Body) != `{"ok":true}` {
		t.Fatalf("got %d %q", res.Status, res.Body)
	}
}

func TestBlocksRedirectToMetadataIP(t *testing.T) {
	s := newServer(t, func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "http://169.254.169.254/latest/meta-data/", http.StatusFound)
	})
	_, err := New(Options{allowLoopback: true}).Get(context.Background(), s.URL)
	if !errors.Is(err, ErrBlocked) {
		t.Fatalf("err = %v, want ErrBlocked", err)
	}
}

func TestBlocksRedirectToOtherScheme(t *testing.T) {
	s := newServer(t, func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "file:///etc/passwd", http.StatusFound)
	})
	_, err := New(Options{allowLoopback: true}).Get(context.Background(), s.URL)
	if !errors.Is(err, ErrBlocked) {
		t.Fatalf("err = %v, want ErrBlocked", err)
	}
}

func TestRejectsNonHTTPScheme(t *testing.T) {
	for _, u := range []string{"file:///etc/passwd", "gopher://example.com", "ftp://example.com/a"} {
		if _, err := New(Options{}).Get(context.Background(), u); !errors.Is(err, ErrBlocked) {
			t.Errorf("%s: err = %v, want ErrBlocked", u, err)
		}
	}
}

func TestStopsAfterThreeRedirects(t *testing.T) {
	var s *httptest.Server
	s = newServer(t, func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, s.URL+r.URL.Path+"x", http.StatusFound)
	})
	_, err := New(Options{allowLoopback: true}).Get(context.Background(), s.URL+"/")
	if !errors.Is(err, ErrTooManyRedirects) {
		t.Fatalf("err = %v, want ErrTooManyRedirects", err)
	}
}

func TestCapsBodySize(t *testing.T) {
	s := newServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(strings.Repeat("a", 2048)))
	})
	_, err := New(Options{allowLoopback: true, MaxBody: 1024}).Get(context.Background(), s.URL)
	if !errors.Is(err, ErrTooLarge) {
		t.Fatalf("err = %v, want ErrTooLarge", err)
	}
}

func TestTimesOut(t *testing.T) {
	s := newServer(t, func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(2 * time.Second):
		case <-r.Context().Done():
		}
	})
	start := time.Now()
	_, err := New(Options{allowLoopback: true, Timeout: 100 * time.Millisecond}).Get(context.Background(), s.URL)
	if err == nil || time.Since(start) > time.Second {
		t.Fatalf("err = %v after %v, want timeout well under 1s", err, time.Since(start))
	}
}

func TestHeadDoesNotReadBody(t *testing.T) {
	s := newServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodHead {
			t.Errorf("method = %s, want HEAD", r.Method)
		}
		w.Header().Set("Content-Type", "video/mp4")
	})
	res, err := New(Options{allowLoopback: true}).Head(context.Background(), s.URL)
	if err != nil {
		t.Fatal(err)
	}
	if res.Header.Get("Content-Type") != "video/mp4" || len(res.Body) != 0 {
		t.Fatalf("got %q body=%d", res.Header.Get("Content-Type"), len(res.Body))
	}
}
