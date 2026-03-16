package api

import (
	"bytes"
	"encoding/json"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"strconv"
	"strings"

	"mak_kart_allk_bot/internal/webapp"
)

// OpenMainMenuRequest — тело POST /api/open-main-menu от мини‑приложения.
// Мини‑приложение присылает initData, по которому мы определяем telegram_id.
type OpenMainMenuRequest struct {
	InitData string `json:"initData"`
}

// MainMenuOpenHandler — HTTP‑обработчик, который по initData
// находит telegram_id и отправляет пользователю главное меню бота
// («Главное меню. Выберите раздел:» + кнопки).
//
// Используется мини‑приложением при нажатии на кнопку «Главное меню».
func MainMenuOpenHandler(botToken string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req OpenMainMenuRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(req.InitData) == "" {
			http.Error(w, "initData is required", http.StatusBadRequest)
			return
		}

		telegramID, err := webapp.ValidateInitData(botToken, req.InitData)
		if err != nil {
			log.Printf("api open-main-menu: initData validation failed: %v (initData=%q)", err, req.InitData)
			http.Error(w, "invalid or expired init data", http.StatusUnauthorized)
			return
		}

		text := "Главное меню. Выберите раздел:"

		miniappURL := strings.TrimSpace(os.Getenv("MINI_APP_URL"))
		if miniappURL == "" {
			miniappURL = "https://localhost:5173/"
		}
		buttonURL := miniappURL
		if strings.Contains(buttonURL, "localhost") {
			buttonURL = "https://example.com"
		}

		replyMarkup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{"text": "🤖 ИИ-психолог Коуч", "callback_data": "main_menu_ai"},
				},
				{
					{"text": "🔢 Цифра дня", "web_app": map[string]string{"url": buttonURL}},
				},
				{
					{"text": "📚 Обучение", "callback_data": "main_menu_education"},
					{"text": "📇 Контакты", "callback_data": "main_menu_contacts"},
				},
				{
					{"text": "🛒 Магазин", "callback_data": "main_menu_shop"},
					{"text": "👤 Личный кабинет", "callback_data": "main_menu_cabinet"},
				},
			},
		}
		markupJSON, _ := json.Marshal(replyMarkup)

		body := &bytes.Buffer{}
		mpw := multipart.NewWriter(body)
		_ = mpw.WriteField("chat_id", strconv.FormatInt(telegramID, 10))
		_ = mpw.WriteField("text", text)
		_ = mpw.WriteField("reply_markup", string(markupJSON))
		_ = mpw.Close()

		reqTG, err := http.NewRequest(http.MethodPost, "https://api.telegram.org/bot"+botToken+"/sendMessage", body)
		if err != nil {
			log.Printf("api open-main-menu: build request failed: %v", err)
			http.Error(w, "failed to build request", http.StatusInternalServerError)
			return
		}
		reqTG.Header.Set("Content-Type", "multipart/form-data; boundary="+mpw.Boundary())

		respTG, err := http.DefaultClient.Do(reqTG)
		if err != nil {
			log.Printf("api open-main-menu: sendMessage failed: %v", err)
			http.Error(w, "failed to send message", http.StatusBadGateway)
			return
		}
		defer respTG.Body.Close()

		if respTG.StatusCode != http.StatusOK {
			log.Printf("api open-main-menu: sendMessage bad status: %d", respTG.StatusCode)
			http.Error(w, "telegram send failed", http.StatusBadGateway)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

