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

// OpenCabinetRequest — тело POST /api/open-cabinet от мини‑приложения.
// Мини‑приложение присылает initData, по которому мы определяем telegram_id.
type OpenCabinetRequest struct {
	InitData string `json:"initData"`
}

// CabinetOpenHandler — HTTP‑обработчик, который по initData
// находит telegram_id и отправляет пользователю меню личного кабинета.
//
// Используется мини‑приложением при нажатии на кнопку «Личный кабинет».
func CabinetOpenHandler(botToken string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req OpenCabinetRequest
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
			log.Printf("api open-cabinet: initData validation failed: %v (initData=%q)", err, req.InitData)
			http.Error(w, "invalid or expired init data", http.StatusUnauthorized)
			return
		}

		text := "Ваш профиль уже заполнен. Добро пожаловать в личный кабинет."

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
					{"text": "👤 Мои данные", "callback_data": "cabinet_my_data"},
				},
				{
					{"text": "✏️ Редактировать профиль", "callback_data": "cabinet_profile"},
				},
				{
					{"text": "📂 Мои разборы", "callback_data": "cabinet_my_reviews"},
				},
				{
					{"text": "🧠 Цифровой психолог", "callback_data": "cabinet_digital_psychologist"},
				},
				{
					{"text": "🔢 Цифра дня", "web_app": map[string]string{"url": buttonURL}},
				},
				{
					{"text": "📚 Обучение", "callback_data": "cabinet_education"},
				},
				{
					{"text": "🏠 Перейти на главную", "callback_data": "ai_coach_main_menu"},
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
			log.Printf("api open-cabinet: build request failed: %v", err)
			http.Error(w, "failed to build request", http.StatusInternalServerError)
			return
		}
		reqTG.Header.Set("Content-Type", "multipart/form-data; boundary="+mpw.Boundary())

		respTG, err := http.DefaultClient.Do(reqTG)
		if err != nil {
			log.Printf("api open-cabinet: sendMessage failed: %v", err)
			http.Error(w, "failed to send message", http.StatusBadGateway)
			return
		}
		defer respTG.Body.Close()

		if respTG.StatusCode != http.StatusOK {
			log.Printf("api open-cabinet: sendMessage bad status: %d", respTG.StatusCode)
			http.Error(w, "telegram send failed", http.StatusBadGateway)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

