// Package provider turns a pasted link into a Ref: which platform it is, its id,
// a canonical URL (dedupe key) and how to embed it. Parsing is pure: no network.
package provider

import (
	"errors"
	"net/url"
	"regexp"
	"strings"
)

// MaxURLLength caps what we accept from users (ARCHITECTURE §4).
const MaxURLLength = 2048

var (
	ErrInvalid     = errors.New("invalid_url")
	ErrUnsupported = errors.New("unsupported_url")
)

// Embed says how the web app plays the video.
type Embed struct {
	Type   string `json:"type"`   // iframe | video | hls
	Src    string `json:"src"`    // official player URL or the original file URL
	Aspect string `json:"aspect"` // 16:9 | 9:16
}

// Ref is everything the parser knows without touching the network.
type Ref struct {
	Source       string `json:"source"` // youtube | direct
	Kind         string `json:"kind"`   // video | short | direct
	ID           string `json:"id"`
	CanonicalURL string `json:"canonicalUrl"`
	Embed        Embed  `json:"embed"`
	Title        string `json:"title,omitempty"` // only when derivable offline (direct files)
}

var schemeRe = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9+.-]*:`)

// Parse validates raw and returns its Ref, ErrInvalid or ErrUnsupported.
func Parse(raw string) (Ref, error) {
	u, err := normalize(raw)
	if err != nil {
		return Ref{}, err
	}
	if ref, ok := parseYouTube(u); ok {
		return ref, nil
	}
	if isYouTubeHost(u.Hostname()) {
		return Ref{}, ErrUnsupported
	}
	if ref, ok := parseDirect(u); ok {
		return ref, nil
	}
	return Ref{}, ErrUnsupported
}

func normalize(raw string) (*url.URL, error) {
	s := strings.TrimSpace(raw)
	if s == "" || len(s) > MaxURLLength || strings.ContainsAny(s, " \t\r\n") {
		return nil, ErrInvalid
	}
	if !schemeRe.MatchString(s) {
		s = "https://" + s
	}
	u, err := url.Parse(s)
	if err != nil {
		return nil, ErrInvalid
	}
	u.Scheme = strings.ToLower(u.Scheme)
	if (u.Scheme != "https" && u.Scheme != "http") || u.Hostname() == "" || u.User != nil {
		return nil, ErrInvalid
	}
	u.Host = strings.ToLower(u.Host)
	return u, nil
}
