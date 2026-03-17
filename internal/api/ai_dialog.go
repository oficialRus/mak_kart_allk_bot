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

// системный промпт для мини‑приложения (ИИ Психолог‑Коуч).
// Важно: баланс вопросов и ответов — не задавать бесконечную серию уточнений.
const aiCoachSystemPrompt = `Ты — ИИ Психолог-Коуч. Веди поддерживающий, бережный диалог, помогай человеку разобраться в чувствах и шагах дальше. Отвечай только на русском языке: никаких английских слов (например «here» писать как «здесь»). Лаконично, без лишних технических деталей, не выдавай себя за живого человека.

Если человек описывает карту, изображение или «карту дня», помни: ты НЕ видишь саму картинку, но ЗНАЕШЬ, что он сейчас на неё смотрит. Никогда не отвечай фразами вроде «я не знаю, о какой карте идёт речь» или «я не вижу карту». Вместо этого работай с его словами, ощущениями и ассоциациями, помогай ему самому найти смысл карты через мягкие интерпретации.

Очень важно: не задавай бесконечную серию уточняющих вопросов. В каждом ответе:
— Кратко отрази суть того, что человек уже сказал (1–2 предложения).
— Дай небольшое осмысление / гипотезу о смысле происходящего (1–3 предложения).
— И только затем задай 1–2 уточняющих вопроса, которые реально помогают продвинуться дальше.

После 2–3 обменов сообщениями переходи от вопросов к более развёрнутому ответу и конкретным мягким рекомендациям (что человек может почувствовать, заметить, попробовать сделать). Не проси описывать одно и то же снова и снова другими словами.`

type aiDialogRequest struct {
	InitData string            `json:"initData"`
	Message  string            `json:"message"`
	History  []historyMessage  `json:"history"`
}

type aiDialogResponse struct {
	Reply string `json:"reply"`
}

// historyMessage описывает один элемент истории диалога,
// приходящий из мини‑приложения.
type historyMessage struct {
	Role    string `json:"role"`    // "user" или "assistant"
	Content string `json:"content"` // текст сообщения
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

		// Собираем сообщения для LLM: системный промпт + история + текущее сообщение.
		messages := []openai.Message{
			{Role: "system", Content: aiCoachSystemPrompt},
		}

		// Берём не всю историю подряд, а, например, последние 10–12 сообщений,
		// чтобы не раздувать контекст.
		const maxHistory = 12
		h := req.History
		if len(h) > maxHistory {
			h = h[len(h)-maxHistory:]
		}
		for _, m := range h {
			role := strings.ToLower(strings.TrimSpace(m.Role))
			if role != "user" && role != "assistant" {
				continue
			}
			text := strings.TrimSpace(m.Content)
			if text == "" {
				continue
			}
			messages = append(messages, openai.Message{
				Role:    role,
				Content: text,
			})
		}

		// Добавляем текущее сообщение пользователя в конец.
		messages = append(messages, openai.Message{
			Role:    "user",
			Content: req.Message,
		})

		resp, userErr := openai.ChatCompletion(
			context.Background(),
			apiKey,
			openai.Request{
				Model: openai.DefaultModel,
				Messages: messages,
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

