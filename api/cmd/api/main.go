// Command api runs the octa link resolver.
//
// Env: PORT (default 8080), ALLOWED_ORIGINS (comma-separated, default
// http://localhost:5173).
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/lucasouzadev/octa/api/internal/fetch"
	"github.com/lucasouzadev/octa/api/internal/httpapi"
	"github.com/lucasouzadev/octa/api/internal/resolve"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	port := envOr("PORT", "8080")
	origins := splitList(envOr("ALLOWED_ORIGINS", "http://localhost:5173"))

	api := httpapi.New(httpapi.Config{
		Resolver:       resolve.New(fetch.New(fetch.Options{}), func() time.Time { return time.Now().UTC() }),
		AllowedOrigins: origins,
		Logger:         logger,
	})

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           api,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		t := time.NewTicker(5 * time.Minute)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				api.Sweep(10 * time.Minute)
			}
		}
	}()

	go func() {
		logger.Info("listening", "addr", srv.Addr, "origins", origins)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown", "err", err)
	}
}

func envOr(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
