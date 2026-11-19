// Package fetch is the only way the API talks to the internet. Every URL it is
// given is hostile (AGENTS.md §1.4): it allows http(s) only, dials public IPs
// only (checked on the resolved address of every connection, so redirects and
// DNS rebinding are covered), follows at most 3 redirects, times out and caps
// the body. It never uses an HTTP proxy, which would hide the real target.
package fetch

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"syscall"
	"time"
)

var (
	ErrBlocked          = errors.New("fetch: destination not allowed")
	ErrTooManyRedirects = errors.New("fetch: too many redirects")
	ErrTooLarge         = errors.New("fetch: response too large")
)

const (
	defaultTimeout = 5 * time.Second
	defaultMaxBody = 1 << 20 // 1 MB
	maxRedirects   = 3
	userAgent      = "octa-link-resolver/0.1 (+https://github.com/lucasouzadev/octa)"
)

type Options struct {
	Timeout time.Duration // total per request; default 5s
	MaxBody int64         // bytes; default 1 MB

	allowLoopback bool // tests only: lets httptest servers on 127.0.0.1 through
}

type Response struct {
	Status int
	Header http.Header
	Body   []byte
	URL    string // final URL after redirects
}

type Client struct {
	hc      *http.Client
	maxBody int64
}

func New(o Options) *Client {
	if o.Timeout <= 0 {
		o.Timeout = defaultTimeout
	}
	if o.MaxBody <= 0 {
		o.MaxBody = defaultMaxBody
	}
	dialer := &net.Dialer{
		Timeout: o.Timeout,
		Control: func(network, address string, _ syscall.RawConn) error {
			ap, err := netip.ParseAddrPort(address)
			if err != nil {
				return ErrBlocked
			}
			ip := ap.Addr().Unmap()
			if o.allowLoopback && ip.IsLoopback() {
				return nil
			}
			if !isPublic(ip) {
				return ErrBlocked
			}
			return nil
		},
	}
	transport := &http.Transport{
		Proxy:                 nil,
		DialContext:           dialer.DialContext,
		TLSHandshakeTimeout:   o.Timeout,
		ResponseHeaderTimeout: o.Timeout,
		MaxIdleConns:          32,
		IdleConnTimeout:       30 * time.Second,
	}
	return &Client{
		maxBody: o.MaxBody,
		hc: &http.Client{
			Transport: transport,
			Timeout:   o.Timeout,
			Jar:       nil,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) > maxRedirects {
					return ErrTooManyRedirects
				}
				if !allowedScheme(req.URL) {
					return ErrBlocked
				}
				return nil
			},
		},
	}
}

func (c *Client) Get(ctx context.Context, rawURL string) (*Response, error) {
	return c.do(ctx, http.MethodGet, rawURL)
}

// Head checks a URL without downloading it (direct video health).
func (c *Client) Head(ctx context.Context, rawURL string) (*Response, error) {
	return c.do(ctx, http.MethodHead, rawURL)
}

func (c *Client) do(ctx context.Context, method, rawURL string) (*Response, error) {
	u, err := url.Parse(rawURL)
	if err != nil || !allowedScheme(u) || u.Hostname() == "" {
		return nil, ErrBlocked
	}
	req, err := http.NewRequestWithContext(ctx, method, u.String(), nil)
	if err != nil {
		return nil, ErrBlocked
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept-Language", "pt-BR,pt;q=0.9,en;q=0.8")

	res, err := c.hc.Do(req)
	if err != nil {
		return nil, classify(err)
	}
	defer res.Body.Close()

	out := &Response{Status: res.StatusCode, Header: res.Header, URL: res.Request.URL.String()}
	if method == http.MethodHead {
		return out, nil
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, c.maxBody+1))
	if err != nil {
		return nil, fmt.Errorf("fetch: read body: %w", err)
	}
	if int64(len(body)) > c.maxBody {
		return nil, ErrTooLarge
	}
	out.Body = body
	return out, nil
}

func classify(err error) error {
	switch {
	case errors.Is(err, ErrBlocked):
		return ErrBlocked
	case errors.Is(err, ErrTooManyRedirects):
		return ErrTooManyRedirects
	}
	return fmt.Errorf("fetch: %w", err)
}

func allowedScheme(u *url.URL) bool {
	return u.Scheme == "http" || u.Scheme == "https"
}

var blockedPrefixes = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"), // CGNAT
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("192.0.2.0/24"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"),
	netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("64:ff9b::/96"),   // NAT64
	netip.MustParsePrefix("64:ff9b:1::/48"), // local NAT64
	netip.MustParsePrefix("2001:db8::/32"),
}

// isPublic reports whether ip is a routable public unicast address.
func isPublic(ip netip.Addr) bool {
	ip = ip.Unmap()
	if !ip.IsValid() || !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() ||
		ip.IsLinkLocalUnicast() || ip.IsMulticast() || ip.IsUnspecified() {
		return false
	}
	for _, p := range blockedPrefixes {
		if p.Contains(ip) {
			return false
		}
	}
	return true
}

// NewForTests returns a client that may also dial loopback, so tests can use
// httptest servers. Never call it outside _test.go files.
func NewForTests(o Options) *Client {
	o.allowLoopback = true
	return New(o)
}
