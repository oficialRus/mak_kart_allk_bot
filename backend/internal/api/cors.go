package api

import (
	"net/http"
	"os"
	"strings"
)

// WithCORS добавляет CORS-заголовки и preflight-обработку для web/PWA клиента.
func WithCORS(next http.Handler) http.Handler {
	allowedOrigins := parseAllowedOrigins(strings.TrimSpace(os.Getenv("ALLOWED_ORIGINS")))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if allowOrigin := resolveAllowedOrigin(origin, allowedOrigins); allowOrigin != "" {
			w.Header().Set("Access-Control-Allow-Origin", allowOrigin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token")
			w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
			if cookieAuthEnabled() {
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func parseAllowedOrigins(v string) map[string]struct{} {
	out := map[string]struct{}{}
	if v == "" {
		return out
	}
	for _, part := range strings.Split(v, ",") {
		origin := strings.TrimSpace(part)
		if origin != "" {
			out[origin] = struct{}{}
		}
	}
	return out
}

func resolveAllowedOrigin(origin string, allowed map[string]struct{}) string {
	if origin == "" {
		return ""
	}
	if len(allowed) == 0 {
		return origin
	}
	if _, ok := allowed[origin]; ok {
		return origin
	}
	return ""
}
