package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"mak_kart_allk_bot/internal/webapp"
	"mak_kart_allk_bot/openai"
)

// тот же системный промпт, что и в handlers/question (скопирован сюда,
// чтобы не тянуть пакет handlers в internal/api).
const aiCoachSystemPrompt = "Ты — ИИ Психолог-Коуч (роль 3 в чате). Веди поддерживающий, бережный диалог, помогай человеку разобраться в чувствах и шагах дальше. Задавай уточняющие вопросы, если не всё понятно. Отвечай только на русском языке: никаких английских слов (например «here» писать как «здесь»). Лаконично, без лишних технических деталей, не выдавай себя за живого человека. Если человек говорит о карте, изображении или «карте дня», помни: ты не видишь саму картинку, но ЗНАЕШЬ, что он сейчас на неё смотрит. Никогда не отвечай фразами вроде «я не знаю, о какой карте идёт речь» или «я не вижу карту». Вместо этого работай с его словами, ощущениями и ассоциациями, помогай ему самому найти смысл карты через вопросы и мягкие интерпретации."

type aiDialogRequest struct {
	InitData string `json:"initData"`
	Message  string `json:"message"`
}

type aiDialogResponse struct {
	Reply string `json:"reply"`
}

// AiDialogHandler — HTTP‑обработчик для мини‑приложения:
// принимает initData и текст пользователя, отвечает коротким
// сообщением ИИ‑Психолога-Коуча (без сохранения истории диалога).
func AiDialogHandler(botToken string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req aiDialogRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}
		req.Message = strings.TrimSpace(req.Message)
		if req.Message == "" {
			http.Error(w, "message is required", http.StatusBadRequest)
			return
		}

		if strings.TrimSpace(req.InitData) == "" {
			http.Error(w, "initData is required", http.StatusBadRequest)
			return
		}

		// Валидируем initData, чтобы не обрабатывать запросы «не от Telegram».
		if _, err := webapp.ValidateInitData(botToken, req.InitData); err != nil {
			log.Printf("api ai-dialog: initData validation failed: %v", err)
			http.Error(w, "invalid or expired init data", http.StatusUnauthorized)
			return
		}

		apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
		if apiKey == "" {
			http.Error(w, "AI is not configured", http.StatusServiceUnavailable)
			return
		}

		resp, userErr := openai.ChatCompletion(
			context.Background(),
			apiKey,
			openai.Request{
				Model: openai.DefaultModel,
				Messages: []openai.Message{
					{Role: "system", Content: aiCoachSystemPrompt},
					{Role: "user", Content: req.Message},
				},
			},
		)
		if userErr != nil {
			log.Printf("api ai-dialog: completion error: %v", userErr)
			http.Error(w, userErr.Text, http.StatusBadGateway)
			return
		}

		reply := ""
		if len(resp.Choices) > 0 {
			reply = strings.TrimSpace(resp.Choices[0].Message.Content)
		}
		if reply == "" {
			reply = "Я не до конца понял ваш запрос. Попробуйте описать ситуацию ещё раз, чуть подробнее."
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(aiDialogResponse{Reply: reply})
	}
}

