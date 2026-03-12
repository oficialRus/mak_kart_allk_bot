package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"mak_kart_allk_bot/internal/repository"
	"mak_kart_allk_bot/internal/webapp"
)

// DailyNumberRequest — тело POST /api/daily-number от мини‑приложения.
// Мини‑приложение присылает только initData, по которому мы определяем telegram_id.
type DailyNumberRequest struct {
	InitData string `json:"initData"`
}

// DailyNumberResponse — ответ c "цифрой дня" (индекс от 0 до 8 для колеса и человекочитаемое число 1..9).
type DailyNumberResponse struct {
	Index int `json:"index"` // 0..8
	Num   int `json:"num"`   // 1..9
}

// DailyNumberHandler обрабатывает POST /api/daily-number:
// проверяет initData, достаёт telegram_id, смотрит/создаёт запись в БД и возвращает цифру дня.
func DailyNumberHandler(botToken string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req DailyNumberRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}
		if req.InitData == "" {
			http.Error(w, "initData is required", http.StatusBadRequest)
			return
		}

		telegramID, err := webapp.ValidateInitData(botToken, req.InitData)
		if err != nil {
			log.Printf("api daily-number: initData validation failed: %v (initData=%q)", err, req.InitData)
			http.Error(w, "invalid or expired init data", http.StatusUnauthorized)
			return
		}

		now := time.Now()
		num, err := repository.GetOrCreateDailyNumber(r.Context(), telegramID, now)
		if err != nil {
			log.Printf("api daily-number: GetOrCreateDailyNumber failed for telegram_id=%d: %v", telegramID, err)
			http.Error(w, "failed to get daily number", http.StatusInternalServerError)
			return
		}

		resp := DailyNumberResponse{
			Index: (num - 1), // 0..8
			Num:   num,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

