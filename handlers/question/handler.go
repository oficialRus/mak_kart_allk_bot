package question

import (
	"context"
	"log"
	"os"
	"strings"
	"sync"

	"mak_kart_allk_bot/openai"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

const (
	maxReplyLen = 4096 // лимит сообщения в Telegram
	// systemPrompt задаёт роль и стиль ИИ:
	// 1. Пользователь
	// 2. Человек‑консультант (может быть в будущем)
	// 3. ИИ Психолог‑Коуч (текущая роль модели)
	systemPrompt = "Ты — ИИ Психолог-Коуч (роль 3 в чате). Веди поддерживающий, бережный диалог, помогай человеку разобраться в чувствах и шагах дальше. Задавай уточняющие вопросы, если не всё понятно. Отвечай только на русском языке: никаких английских слов (например «here» писать как «здесь»). Лаконично, без лишних технических деталей, не выдавай себя за живого человека."
	userPrompt   = "Пользователь открыл раздел «Вопрос». Кратко поприветствуй его как ИИ Психолог-Коуч и предложи описать ситуацию или задать вопрос.Важно следующее: в совсем приветствии ты должен сказать только 'Привет! Я ИИ Психолог-Коуч. Как я могу помочь?'" 
)

// простая in-memory сессия по chatID
type chatSession struct {
	Messages []openai.Message
}

var (
	sessionsMu sync.Mutex
	sessions   = make(map[int64]*chatSession)
)

// Handle обрабатывает нажатие на кнопку «Вопрос» — отправляет приветствие от ИИ
// и инициализирует диалоговую сессию.
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		sendFallback(bot, chatID, "ИИ-ответы временно недоступны. Задайте OPENAI_API_KEY в .env и перезапустите бота.")
		return
	}

	resp, userErr := openai.ChatCompletion(
		context.Background(),
		apiKey,
		openai.Request{
			Model: openai.DefaultModel,
			Messages: []openai.Message{
				{Role: "system", Content: systemPrompt},
				{Role: "user", Content: userPrompt},
			},
		},
	)
	if userErr != nil {
		sendFallback(bot, chatID, userErr.Text)
		return
	}

	text := ""
	if len(resp.Choices) > 0 {
		text = strings.TrimSpace(resp.Choices[0].Message.Content)
	}
	if text == "" {
		text = "Раздел «Вопрос» в разработке. Вы можете описать свою ситуацию прямо в чате."
	}
	if len(text) > maxReplyLen {
		text = text[:maxReplyLen-3] + "..."
	}

	// сохраняем/обнуляем сессию для чата: system + первое приветствие ассистента
	saveSession(chatID, []openai.Message{
		{Role: "system", Content: systemPrompt},
		{Role: "assistant", Content: text},
	})

	msg := tgbotapi.NewMessage(chatID, text)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending question message: %v", err)
	}
}

// HandleUserMessage обрабатывает обычные текстовые сообщения,
// если для чата есть активная сессия «Вопрос».
// Возвращает true, если сообщение было обработано этим хендлером.
func HandleUserMessage(bot *tgbotapi.BotAPI, chatID int64, userText string) bool {
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		return false
	}

	sessionsMu.Lock()
	session, ok := sessions[chatID]
	if !ok || session == nil {
		sessionsMu.Unlock()
		return false
	}

	// добавляем новое пользовательское сообщение в историю
	session.Messages = append(session.Messages, openai.Message{
		Role:    "user",
		Content: strings.TrimSpace(userText),
	})

	// ограничиваем историю, чтобы не разрасталась бесконечно
	const maxMessages = 20
	if len(session.Messages) > maxMessages {
		// оставляем system + последние сообщения
		systemMsg := session.Messages[0]
		tail := session.Messages[len(session.Messages)-(maxMessages-1):]
		session.Messages = append([]openai.Message{systemMsg}, tail...)
	}

	// локальная копия для запроса
	messagesCopy := make([]openai.Message, len(session.Messages))
	copy(messagesCopy, session.Messages)
	sessionsMu.Unlock()

	reply := ""
	resp, userErr := openai.ChatCompletion(
		context.Background(),
		apiKey,
		openai.Request{
			Model:    openai.DefaultModel,
			Messages: messagesCopy,
		},
	)
	if userErr != nil {
		sendFallback(bot, chatID, userErr.Text)
		return true
	}

	if len(resp.Choices) > 0 {
		reply = strings.TrimSpace(resp.Choices[0].Message.Content)
	}
	if reply == "" {
		reply = "Я не до конца понял ваш запрос. Попробуйте описать ситуацию ещё раз, чуть подробнее."
	}
	if len(reply) > maxReplyLen {
		reply = reply[:maxReplyLen-3] + "..."
	}

	// добавляем ответ ассистента в историю
	sessionsMu.Lock()
	if session, ok := sessions[chatID]; ok && session != nil {
		session.Messages = append(session.Messages, openai.Message{
			Role:    "assistant",
			Content: reply,
		})
	}
	sessionsMu.Unlock()

	msg := tgbotapi.NewMessage(chatID, reply)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending question dialog message: %v", err)
	}

	return true
}

func sendFallback(bot *tgbotapi.BotAPI, chatID int64, text string) {
	msg := tgbotapi.NewMessage(chatID, text)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending question fallback: %v", err)
	}
}

// saveSession перезаписывает сессию диалога «Вопрос» для чата.
func saveSession(chatID int64, messages []openai.Message) {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()

	sessions[chatID] = &chatSession{
		Messages: messages,
	}
}
