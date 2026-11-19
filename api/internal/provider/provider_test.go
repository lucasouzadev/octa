package provider

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

type vector struct {
	Name         string `json:"name"`
	URL          string `json:"url"`
	Source       string `json:"source"`
	Kind         string `json:"kind"`
	ID           string `json:"id"`
	CanonicalURL string `json:"canonicalUrl"`
	EmbedSrc     string `json:"embedSrc"`
	Aspect       string `json:"aspect"`
	Title        string `json:"title"`
	Error        string `json:"error"`
}

func loadVectors(t *testing.T) []vector {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "testdata", "urls.json"))
	if err != nil {
		t.Fatalf("read vectors: %v", err)
	}
	var file struct {
		Cases []vector `json:"cases"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatalf("parse vectors: %v", err)
	}
	if len(file.Cases) == 0 {
		t.Fatal("no vectors")
	}
	return file.Cases
}

func TestParseSharedVectors(t *testing.T) {
	for _, v := range loadVectors(t) {
		t.Run(v.Name, func(t *testing.T) {
			ref, err := Parse(v.URL)
			if v.Error != "" {
				want := map[string]error{"unsupported_url": ErrUnsupported, "invalid_url": ErrInvalid}[v.Error]
				if !errors.Is(err, want) {
					t.Fatalf("Parse(%q) error = %v, want %v", v.URL, err, want)
				}
				return
			}
			if err != nil {
				t.Fatalf("Parse(%q) unexpected error: %v", v.URL, err)
			}
			got := map[string]string{
				"source": ref.Source, "kind": ref.Kind, "id": ref.ID, "canonicalUrl": ref.CanonicalURL,
				"embedSrc": ref.Embed.Src, "aspect": ref.Embed.Aspect, "title": ref.Title,
			}
			want := map[string]string{
				"source": v.Source, "kind": v.Kind, "id": v.ID, "canonicalUrl": v.CanonicalURL,
				"embedSrc": v.EmbedSrc, "aspect": v.Aspect, "title": v.Title,
			}
			for k, w := range want {
				if got[k] != w {
					t.Errorf("%s = %q, want %q", k, got[k], w)
				}
			}
		})
	}
}

func TestParseRejectsOverlongURL(t *testing.T) {
	long := "https://www.youtube.com/watch?v=dQw4w9WgXcQ&x="
	for len(long) <= MaxURLLength {
		long += "a"
	}
	if _, err := Parse(long); !errors.Is(err, ErrInvalid) {
		t.Fatalf("error = %v, want ErrInvalid", err)
	}
}
