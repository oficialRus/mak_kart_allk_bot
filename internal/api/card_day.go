package api

import (
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"mak_kart_allk_bot/internal/repository"
	"mak_kart_allk_bot/internal/webapp"
)

type cardDayRequest struct {
	InitData string `json:"initData"`
}

type cardDayResponse struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	ImagePath   string `json:"image_path"`
	DayMessage  string `json:"day_message,omitempty"`
}

// CardDayHandler — HTTP‑обработчик для мини‑приложения:
// по initData определяет пользователя, выдаёт или находит его «карту дня»
// и возвращает её заголовок и описание в JSON.
func CardDayHandler(botToken string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req cardDayRequest
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
			log.Printf("api card-day: initData validation failed: %v", err)
			http.Error(w, "invalid or expired init data", http.StatusUnauthorized)
			return
		}

		exclusionDays := 14
		if v := os.Getenv("CARD_DAY_EXCLUSION_DAYS"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				exclusionDays = n
			}
		}

		ctx := r.Context()
		outcome, err := repository.GetOrAssignCardOfDay(ctx, telegramID, exclusionDays)
		if err != nil {
			log.Printf("api card-day: GetOrAssignCardOfDay failed for user %d: %v", telegramID, err)
			http.Error(w, "failed to get card of the day", http.StatusInternalServerError)
			return
		}

		if outcome == nil {
			http.Error(w, "no cards available", http.StatusNotFound)
			return
		}

		card := outcome.Card

		publicPath := ""
		if card.ImagePath != "" {
			publicPath = "/api/card-image?name=" + url.QueryEscape(filepath.Base(card.ImagePath))
		}

		resp := cardDayResponse{
			Title:       card.Title,
			Description: card.Description,
			ImagePath:   publicPath,
		}

		cached := strings.TrimSpace(outcome.CachedDayMessage)
		if cached != "" {
			resp.DayMessage = cached
		} else {
			var msg string
			apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
			if apiKey == "" {
				log.Printf("api card-day: OPENAI_API_KEY is empty, using fallback day_message (user %d)", telegramID)
			} else {
				msg = generateCardDayMessageText(ctx, apiKey, card.Title, card.Description)
				if msg == "" {
					log.Printf("api card-day: AI returned empty day_message, fallback (user %d)", telegramID)
				}
			}
			if msg == "" {
				msg = fallbackCardDayMessage(card.Title, card.Description)
			}
			resp.DayMessage = msg
			if err := repository.SaveCardDayCachedMessage(ctx, telegramID, msg); err != nil {
				log.Printf("api card-day: SaveCardDayCachedMessage failed for user %d: %v", telegramID, err)
			}
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(resp)
	}
}
