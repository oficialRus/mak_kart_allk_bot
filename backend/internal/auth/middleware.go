package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"mak_kart_allk_bot/internal/repository"
)

type ctxUserIDKey struct{}

// UserIDFromContext возвращает user_id, установленный RequireAuth.
func UserIDFromContext(ctx context.Context) (int64, bool) {
	v, ok := ctx.Value(ctxUserIDKey{}).(int64)
	return v, ok
}

// LegacyInitDataValidator валидирует initData и возвращает user_id.
type LegacyInitDataValidator func(ctx context.Context, initData string) (int64, error)

// RequireAuth сначала проверяет Bearer session token, а если токен отсутствует —
// использует legacy fallback по initData.
func RequireAuth(pepper string, allowBearer bool, legacy LegacyInitDataValidator, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization := strings.TrimSpace(r.Header.Get("Authorization"))
		if authorization != "" {
			if !allowBearer {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			const pref = "Bearer "
			if !strings.HasPrefix(authorization, pref) {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			token := strings.TrimSpace(strings.TrimPrefix(authorization, pref))
			if token == "" {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			userID, ok, err := repository.ValidateCabinetSessionToken(r.Context(), token, pepper)
			if err != nil || !ok {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), ctxUserIDKey{}, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		if allowBearer {
			if c, err := r.Cookie("cabinet_session"); err == nil && strings.TrimSpace(c.Value) != "" {
			token := strings.TrimSpace(c.Value)
			userID, ok, err := repository.ValidateCabinetSessionToken(r.Context(), token, pepper)
			if err != nil || !ok {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			if requiresCSRF(r.Method) {
				csrfCookie, err := r.Cookie("cabinet_csrf")
				if err != nil || strings.TrimSpace(csrfCookie.Value) == "" {
					http.Error(w, "forbidden", http.StatusForbidden)
					return
				}
				csrfHeader := strings.TrimSpace(r.Header.Get("X-CSRF-Token"))
				if csrfHeader == "" || csrfHeader != strings.TrimSpace(csrfCookie.Value) {
					http.Error(w, "forbidden", http.StatusForbidden)
					return
				}
			}
			ctx := context.WithValue(r.Context(), ctxUserIDKey{}, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}
		}

		if legacy == nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		initData := extractInitData(r)
		if initData == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		userID, err := legacy(r.Context(), initData)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), ctxUserIDKey{}, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func requiresCSRF(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return false
	default:
		return true
	}
}

func extractInitData(r *http.Request) string {
	if q := strings.TrimSpace(r.URL.Query().Get("initData")); q != "" {
		return q
	}
	if h := strings.TrimSpace(r.Header.Get("X-Telegram-Init-Data")); h != "" {
		return h
	}
	if r.Body == nil || (r.Method != http.MethodPost && r.Method != http.MethodPut && r.Method != http.MethodPatch) {
		return ""
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		return ""
	}
	r.Body = io.NopCloser(bytes.NewBuffer(body))
	if len(body) == 0 {
		return ""
	}

	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return ""
	}
	v, _ := payload["initData"].(string)
	return strings.TrimSpace(v)
}
