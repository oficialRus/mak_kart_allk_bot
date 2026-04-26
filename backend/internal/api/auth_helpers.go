package api

import (
	"context"
	"net/http"

	"mak_kart_allk_bot/internal/auth"
	"mak_kart_allk_bot/internal/webapp"
)

func withSessionOrInitData(botToken string, next func(http.ResponseWriter, *http.Request, int64)) http.HandlerFunc {
	mode := currentAuthMode()
	legacy := func(ctx context.Context, initData string) (int64, error) {
		telegramID, err := webapp.ValidateInitData(botToken, initData)
		if err != nil {
			return 0, err
		}
		return auth.ResolveByTelegram(ctx, telegramID)
	}
	allowBearer := mode != authModeTelegramOnly
	var legacyFn auth.LegacyInitDataValidator
	if mode != authModeEmailOnly {
		legacyFn = legacy
	}
	h := auth.RequireAuth(cabinetSessionPepper(), allowBearer, legacyFn, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next(w, r, userID)
	}))
	return func(w http.ResponseWriter, r *http.Request) {
		h.ServeHTTP(w, r)
	}
}
