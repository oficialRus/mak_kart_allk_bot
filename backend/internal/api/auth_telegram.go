package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"mak_kart_allk_bot/internal/auth"
	"mak_kart_allk_bot/internal/webapp"
)

type authTelegramRequest struct {
	InitData string `json:"initData"`
}

// AuthTelegramHandler POST /api/auth/telegram
// Обмен initData на стандартную cabinet session (opaque token).
func AuthTelegramHandler(botToken string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if currentAuthMode() == authModeEmailOnly {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if strings.TrimSpace(botToken) == "" {
			http.NotFound(w, r)
			return
		}
		var req authTelegramRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeEmailJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request"})
			return
		}
		initData := strings.TrimSpace(req.InitData)
		if initData == "" {
			writeEmailJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request"})
			return
		}
		telegramID, err := webapp.ValidateInitData(botToken, initData)
		if err != nil {
			log.Printf("api auth/telegram: initData invalid: %v", err)
			writeEmailJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		userID, err := auth.ResolveByTelegram(r.Context(), telegramID)
		if err != nil {
			log.Printf("api auth/telegram: resolve user failed tg=%d err=%v", telegramID, err)
			writeEmailJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}
		issueCabinetSessionJSON(r.Context(), w, userID, "", nil)
	}
}
