package question

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

const (
	openAIURL     = "https://api.openai.com/v1/chat/completions"
	model         = "gpt-4o-mini"
	maxReplyLen  = 4096 // лимит сообщения в Telegram
	systemPrompt  = "Ты дружелюбный ИИ психолог-коуч. Пользователь открыл раздел «Вопрос». Кратко поприветствуй и предложи описать ситуацию или задать вопрос в чате. Отвечай на русском, лаконично."
	userPrompt    = "Пользователь нажал кнопку «Вопрос». Дай короткое приветствие и приглашение описать ситуацию или задать вопрос."
)

// openAI request/response structures
type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIRequest struct {
	Model    string         `json:"model"`
	Messages []openAIMessage `json:"messages"`
}

type openAIChoice struct {
	Message openAIMessage `json:"message"`
}

type openAIResponse struct {
	Choices []openAIChoice `json:"choices"`
}

// Handle обрабатывает раздел «Вопрос»: запрашивает ответ у GPT и отправляет его в чат.
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		sendFallback(bot, chatID, "ИИ-ответы временно недоступны. Задайте OPENAI_API_KEY в .env и перезапустите бота.")
		return
	}

	body, err := json.Marshal(openAIRequest{
		Model: model,
		Messages: []openAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
	})
	if err != nil {
		log.Printf("question: marshal request: %v", err)
		sendFallback(bot, chatID, "Раздел «Вопрос» в разработке. Вы можете описать свою ситуацию прямо в чате.")
		return
	}

	req, err := http.NewRequest(http.MethodPost, openAIURL, bytes.NewReader(body))
	if err != nil {
		log.Printf("question: new request: %v", err)
		sendFallback(bot, chatID, "Раздел «Вопрос» в разработке. Вы можете описать свою ситуацию прямо в чате.")
		return
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("question: openai request: %v", err)
		sendFallback(bot, chatID, "Сейчас не удалось связаться с ИИ. Попробуйте позже или опишите ситуацию в чате.")
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		log.Printf("question: openai status %d: %s", resp.StatusCode, string(respBody))
		sendFallback(bot, chatID, "ИИ временно недоступен. Попробуйте позже или опишите ситуацию в чате.")
		return
	}

	var out openAIResponse
	if err := json.Unmarshal(respBody, &out); err != nil {
		log.Printf("question: unmarshal openai response: %v", err)
		sendFallback(bot, chatID, "Раздел «Вопрос» в разработке. Вы можете описать свою ситуацию прямо в чате.")
		return
	}

	text := ""
	if len(out.Choices) > 0 {
		text = strings.TrimSpace(out.Choices[0].Message.Content)
	}
	if text == "" {
		text = "Раздел «Вопрос» в разработке. Вы можете описать свою ситуацию прямо в чате."
	}
	if len(text) > maxReplyLen {
		text = text[:maxReplyLen-3] + "..."
	}

	msg := tgbotapi.NewMessage(chatID, text)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending question message: %v", err)
	}
}

func sendFallback(bot *tgbotapi.BotAPI, chatID int64, text string) {
	msg := tgbotapi.NewMessage(chatID, text)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending question fallback: %v", err)
	}
}
