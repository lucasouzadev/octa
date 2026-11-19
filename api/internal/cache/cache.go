// Package cache is a small in-memory TTL cache with a hard size cap, so
// repeated pastes of the same link do not hit upstream platforms again.
package cache

import (
	"sync"
	"time"
)

type entry[V any] struct {
	v   V
	exp time.Time
}

type TTL[K comparable, V any] struct {
	mu  sync.Mutex
	m   map[K]entry[V]
	max int
	now func() time.Time
}

func New[K comparable, V any](max int, now func() time.Time) *TTL[K, V] {
	return &TTL[K, V]{m: make(map[K]entry[V], max), max: max, now: now}
}

func (c *TTL[K, V]) Get(k K) (V, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.m[k]
	if !ok || !c.now().Before(e.exp) {
		delete(c.m, k)
		var zero V
		return zero, false
	}
	return e.v, true
}

func (c *TTL[K, V]) Set(k K, v V, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, exists := c.m[k]; !exists && len(c.m) >= c.max {
		c.evictLocked()
	}
	c.m[k] = entry[V]{v: v, exp: c.now().Add(ttl)}
}

func (c *TTL[K, V]) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.m)
}

// evictLocked drops expired entries; if none expired, drops one arbitrary entry.
func (c *TTL[K, V]) evictLocked() {
	now := c.now()
	for k, e := range c.m {
		if !now.Before(e.exp) {
			delete(c.m, k)
		}
	}
	if len(c.m) < c.max {
		return
	}
	for k := range c.m {
		delete(c.m, k)
		return
	}
}
