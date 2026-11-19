package provider

import (
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

var (
	ytIDRe    = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)
	ytStartRe = regexp.MustCompile(`^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$`)
)

func isYouTubeHost(host string) bool {
	switch strings.TrimPrefix(host, "www.") {
	case "youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "youtube-nocookie.com":
		return true
	}
	return false
}

func parseYouTube(u *url.URL) (Ref, bool) {
	host := strings.TrimPrefix(u.Hostname(), "www.")
	if !isYouTubeHost(host) {
		return Ref{}, false
	}
	segs := strings.Split(strings.Trim(u.Path, "/"), "/")
	var id, kind = "", "video"
	switch {
	case host == "youtu.be" && len(segs) >= 1:
		id = segs[0]
	case len(segs) >= 1 && segs[0] == "watch":
		id = u.Query().Get("v")
	case len(segs) >= 2 && segs[0] == "shorts":
		id, kind = segs[1], "short"
	case len(segs) >= 2 && (segs[0] == "live" || segs[0] == "embed"):
		id = segs[1]
	}
	if !ytIDRe.MatchString(id) {
		return Ref{}, false
	}

	canonical := "https://www.youtube.com/watch?v=" + id
	aspect := "16:9"
	if kind == "short" {
		canonical = "https://www.youtube.com/shorts/" + id
		aspect = "9:16"
	}
	embed := "https://www.youtube-nocookie.com/embed/" + id + "?playsinline=1&rel=0"
	if start := ytStart(u.Query()); start > 0 {
		embed += "&start=" + strconv.Itoa(start)
	}
	return Ref{
		Source: "youtube", Kind: kind, ID: id, CanonicalURL: canonical,
		Embed: Embed{Type: "iframe", Src: embed, Aspect: aspect},
	}, true
}

// ytStart reads t= or start= ("42", "42s", "1m30s", "1h2m3s") as seconds.
func ytStart(q url.Values) int {
	v := q.Get("t")
	if v == "" {
		v = q.Get("start")
	}
	m := ytStartRe.FindStringSubmatch(v)
	if v == "" || m == nil {
		return 0
	}
	total := 0
	for i, mult := range []int{3600, 60, 1} {
		if n, err := strconv.Atoi(m[i+1]); err == nil {
			total += n * mult
		}
	}
	return total
}
