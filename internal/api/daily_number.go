package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"mak_kart_allk_bot/internal/dailynumber"
	"mak_kart_allk_bot/internal/db"
	"mak_kart_allk_bot/internal/repository"
	"mak_kart_allk_bot/internal/webapp"
	"mak_kart_allk_bot/openai"
)

// DailyNumberRequest — тело POST /api/daily-number от мини‑приложения.
// Мини‑приложение присылает только initData, по которому мы определяем telegram_id.
type DailyNumberRequest struct {
	InitData string `json:"initData"`
}

// DailyNumberResponse — ответ c "цифрой дня"
// (индекс от 0 до 8 для колеса, человекочитаемое число 1..9 и опциональное послание дня).
type DailyNumberResponse struct {
	Index   int    `json:"index"`             // 0..8
	Num     int    `json:"num"`               // 1..9
	Message string `json:"message,omitempty"` // мотивационное послание дня
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
		ctx := r.Context()
		num, err := repository.GetOrCreateDailyNumber(ctx, telegramID, now)
		if err != nil {
			log.Printf("api daily-number: GetOrCreateDailyNumber failed for telegram_id=%d: %v", telegramID, err)
			http.Error(w, "failed to get daily number", http.StatusInternalServerError)
			return
		}

		// Вычисляем тот же календарный день по Москве, который использует репозиторий.
		msk := time.FixedZone("MSK", 3*60*60)
		local := now.In(msk)
		forDate := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)

		resp := DailyNumberResponse{
			Index: (num - 1), // 0..8
			Num:   num,
		}

		// Сначала пробуем взять уже сгенерированное послание из БД,
		// чтобы за один календарный день по МСК текст был стабильным.
		var existing sql.NullString
		err = db.Pool.QueryRowContext(
			ctx,
			`SELECT message FROM mini_app_daily_numbers WHERE telegram_id = $1 AND for_date = $2`,
			telegramID,
			forDate,
		).Scan(&existing)
		if err != nil && err != sql.ErrNoRows {
			log.Printf("api daily-number: select existing message failed for telegram_id=%d: %v", telegramID, err)
		}

		if existing.Valid && strings.TrimSpace(existing.String) != "" {
			resp.Message = existing.String
		} else {
			// Пытаемся сгенерировать короткое послание дня через OpenAI.
			// Если что-то пойдёт не так, просто вернём цифру без текста.
			if p, ok := dailynumber.ParamsByNum[num]; ok {
				apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
				if apiKey != "" {
					msg, errText := generateDailyMessage(ctx, apiKey, num, p)
					if errText != "" {
						log.Printf("api daily-number: failed to generate message for num=%d: %s", num, errText)
					} else if msg != "" {
						resp.Message = msg
						// Кешируем сгенерированное послание в БД, чтобы в течение дня не звать ИИ повторно.
						if _, err := db.Pool.ExecContext(
							ctx,
							`UPDATE mini_app_daily_numbers SET message = $3 WHERE telegram_id = $1 AND for_date = $2`,
							telegramID,
							forDate,
							msg,
						); err != nil {
							log.Printf("api daily-number: failed to update message for telegram_id=%d: %v", telegramID, err)
						}
					}
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// generateDailyMessage собирает промпт и запрашивает OpenAI для послания дня.
// Возвращает текст послания и строку-ошибку для логов (если что-то пошло не так).
func generateDailyMessage(ctx context.Context, apiKey string, num int, p dailynumber.DigitParams) (string, string) {
	userPrompt := dailynumber.BuildUserPrompt(num, p)

	resp, userErr := openai.ChatCompletion(ctx, apiKey, openai.Request{
		Model: openai.DefaultModel,
		Messages: []openai.Message{
			{Role: "system", Content: dailynumber.SystemPrompt},
			{Role: "user", Content: userPrompt},
		},
	})
	if userErr != nil {
		return "", userErr.Text
	}
	if len(resp.Choices) == 0 {
		return "", "no choices returned"
	}
	text := strings.TrimSpace(resp.Choices[0].Message.Content)
	return text, ""
}


