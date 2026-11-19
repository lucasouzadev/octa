package cache

import (
	"testing"
	"time"
)

func TestGetReturnsFreshValue(t *testing.T) {
	now := time.Unix(0, 0)
	c := New[string, int](10, func() time.Time { return now })
	c.Set("a", 1, time.Minute)
	if v, ok := c.Get("a"); !ok || v != 1 {
		t.Fatalf("Get = %v, %v; want 1, true", v, ok)
	}
}

func TestGetMissesAfterTTL(t *testing.T) {
	now := time.Unix(0, 0)
	c := New[string, int](10, func() time.Time { return now })
	c.Set("a", 1, time.Minute)
	now = now.Add(61 * time.Second)
	if _, ok := c.Get("a"); ok {
		t.Fatal("expected miss after TTL")
	}
}

func TestNeverExceedsCapacity(t *testing.T) {
	c := New[int, int](3, time.Now)
	for i := 0; i < 10; i++ {
		c.Set(i, i, time.Hour)
	}
	if n := c.Len(); n > 3 {
		t.Fatalf("Len = %d, want ≤ 3", n)
	}
	if v, ok := c.Get(9); !ok || v != 9 {
		t.Fatal("most recent entry must be kept")
	}
}
