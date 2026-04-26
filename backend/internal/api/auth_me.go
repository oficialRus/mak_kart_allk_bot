package api

import (
	"context"
	"database/sql"
	"log"
	"net/http"

	"mak_kart_allk_bot/internal/auth"
	"mak_kart_allk_bot/internal/db"
	"mak_kart_allk_bot/internal/webapp"
)

type authMeResponse struct {
	OK            bool   `json:"ok"`
	UserID        int64  `json:"userId"`
	TelegramID    *int64 `json:"telegramId,omitempty"`
	Email         string `json:"email,omitempty"`
	EmailVerified bool   `json:"emailVerified"`
}

// AuthMeHandler GET /api/auth/me
// user_id берётся из Bearer-токена, а при его отсутствии — через legacy initData.
func AuthMeHandler(botToken string) http.Handler {
	legacy := func(ctx context.Context, initData string) (int64, error) {
		telegramID, err := webapp.ValidateInitData(botToken, initData)
		if err != nil {
			return 0, err
		}
		return auth.ResolveByTelegram(ctx, telegramID)
	}
	mode := currentAuthMode()
	allowBearer := mode != authModeTelegramOnly
	var legacyFn auth.LegacyInitDataValidator
	if mode != authModeEmailOnly {
		legacyFn = legacy
	}
	return auth.RequireAuth(cabinetSessionPepper(), allowBearer, legacyFn, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeEmailJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		var (
			tgID  sql.NullInt64
			email sql.NullString
			ver   sql.NullTime
		)
		err := db.Pool.QueryRowContext(r.Context(), `
			SELECT telegram_id, COALESCE(email::text, ''), email_verified_at
			FROM users
			WHERE id = $1
			LIMIT 1;
		`, userID).Scan(&tgID, &email, &ver)
		if err != nil && err != sql.ErrNoRows {
			log.Printf("api auth/me: db error user_id=%d err=%v", userID, err)
			writeEmailJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		resp := authMeResponse{
			OK:            true,
			UserID:        userID,
			Email:         email.String,
			EmailVerified: ver.Valid && email.String != "",
		}
		if tgID.Valid {
			v := tgID.Int64
			resp.TelegramID = &v
		}
		writeEmailJSON(w, http.StatusOK, resp)
	}))
}
