package question

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"mak_kart_allk_bot/openai"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

const (
	maxReplyLen = 4096 // лимит сообщения в Telegram
	// systemPrompt задаёт роль и стиль ИИ:
	// 1. Пользователь
	// 2. Человек‑консультант (может быть в будущем)
	// 3. ИИ Психолог‑Коуч (текущая роль модели)
	systemPrompt = "Ты — ИИ Психолог-Коуч (роль 3 в чате). Веди поддерживающий, бережный диалог, помогай человеку разобраться в чувствах и шагах дальше. Задавай уточняющие вопросы, если не всё понятно. Отвечай только на русском языке: никаких английских слов (например «here» писать как «здесь»). Лаконично, без лишних технических деталей, не выдавай себя за живого человека. Если человек говорит о карте, изображении или «карте дня», помни: ты не видишь саму картинку, но ЗНАЕШЬ, что он сейчас на неё смотрит. Никогда не отвечай фразами вроде «я не знаю, о какой карте идёт речь» или «я не вижу карту». Вместо этого работай с его словами, ощущениями и ассоциациями, помогай ему самому найти смысл карты через вопросы и мягкие интерпретации."
	// systemPromptDigital задаёт стиль «Цифрового психолога»:
	// работа с числами, датами, матрицами, жизненными циклами в мягком, коучинговом формате.
	systemPromptDigital = "Ты — ИИ Цифровой психолог. Ты работаешь с числами, датами рождения, важными датами и количествами (например, цифры дня, месяца, года, возраст, количество повторяющихся событий). Ты умеешь строить и описывать психологические и жизненные матрицы по числам (например, матрица судьбы, матрица ресурсов, матрица отношений), но всегда остаёшься бережным психологом, а не мистиком. Объясняй значения чисел простым человеческим языком, связывай их с реальной жизнью человека и его запросом. Помогай видеть закономерности и возможные уроки, предлагай мягкие шаги и вопросы для самонаблюдения. Не давай категоричных предсказаний и «приговоров», не пугай человека. Всегда подчёркивай, что цифры — это инструмент для осознания, а выбор и ответственность остаются за человеком. Отвечай только на русском языке."
	userPrompt          = "Пользователь открыл раздел «Вопрос». Кратко поприветствуй его как ИИ Психолог-Коуч и предложи описать ситуацию или задать вопрос.Важно следующее: в совсем приветствии ты должен сказать только 'Привет! Я ИИ Психолог-Коуч. Как я могу помочь?'" 
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

	text := `Ты можешь задать любой вопрос ИИ-психологу.

Он поможет тебе:
— расшифровать выпавшую карту
— разобрать ситуацию через цифровую психологию
— получить психологическую технику
— понять послание метафорической карты

Напиши свой вопрос и начни диалог.`

	if len(text) > maxReplyLen {
		text = text[:maxReplyLen-3] + "..."
	}

	// сохраняем/обнуляем сессию для чата: system + первое приветствие ассистента
	saveSession(chatID, []openai.Message{
		{Role: "system", Content: systemPrompt},
		{Role: "assistant", Content: text},
	})

	msg := tgbotapi.NewMessage(chatID, text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🛑 Завершить диалог", "question_end"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending question message: %v", err)
	}
}

// HandleDigital запускает отдельный диалог с ИИ как с «Цифровым психологом».
// Используется из личного кабинета.
func HandleDigital(bot *tgbotapi.BotAPI, chatID int64) {
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		sendFallback(bot, chatID, "ИИ-ответы временно недоступны. Задайте OPENAI_API_KEY в .env и перезапустите бота.")
		return
	}

	text := "Привет! Я ИИ Цифровой психолог.\n\n" +
		"Я помогаю разбирать ваши запросы через числа: дату рождения, важные даты, повторяющиеся цифры и жизненные циклы.\n\n" +
		"Могу:\n" +
		"— сделать числовой разбор по дате рождения\n" +
		"— построить матрицу по ключевым числам и мягко её объяснить\n" +
		"— посмотреть, какие цифры повторяются в вашей ситуации и о чём они могут говорить\n\n" +
		"Напишите, пожалуйста, с чем хотите поработать: можете дать дату рождения, важную дату или просто описать свою ситуацию, а я подскажу, с каких чисел начать."

	if len(text) > maxReplyLen {
		text = text[:maxReplyLen-3] + "..."
	}

	saveSession(chatID, []openai.Message{
		{Role: "system", Content: systemPromptDigital},
		{Role: "assistant", Content: text},
	})

	msg := tgbotapi.NewMessage(chatID, text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🛑 Завершить диалог", "question_end"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending digital psychologist message: %v", err)
	}

	// Через 1 секунду задаём конкретный уточняющий вопрос про разбор по дате рождения.
	go func() {
		time.Sleep(1 * time.Second)

		followup := "Хотите, чтобы я сделал разбор по вашей дате рождения?\n\n" +
			"Если да — просто напишите в чат: «Да» и укажите вашу дату рождения в формате ДД.ММ.ГГГГ."

		followupMsg := tgbotapi.NewMessage(chatID, followup)
		if _, err := bot.Send(followupMsg); err != nil {
			log.Printf("ERROR sending digital psychologist follow-up: %v", err)
		}
	}()
}

// StartSilentSession инициализирует диалоговую сессию «Вопрос» без отправки
// отдельного приветственного сообщения. Используется, когда приветственный
// текст уже отправлен другим обработчиком (например, «Карта дня»).
// optionalContext описывает ситуацию (например, какая карта дня выпала).
func StartSilentSession(bot *tgbotapi.BotAPI, chatID int64, optionalContext string) {
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		sendFallback(bot, chatID, "ИИ-ответы временно недоступны. Задайте OPENAI_API_KEY в .env и перезапустите бота.")
		return
	}

	messages := []openai.Message{
		{Role: "system", Content: systemPrompt},
	}
	if ctx := strings.TrimSpace(optionalContext); ctx != "" {
		messages = append(messages, openai.Message{
			Role:    "user",
			Content: ctx,
		})
	}

	saveSession(chatID, messages)
}

// HandleWithTechnique запускает диалог с ИИ, передавая контекст выбранной техники.
func HandleWithTechnique(bot *tgbotapi.BotAPI, chatID int64, techniqueTitle, techniqueDescription string) {
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		sendFallback(bot, chatID, "ИИ-ответы временно недоступны. Задайте OPENAI_API_KEY в .env и перезапустите бота.")
		return
	}

	contextPrompt := fmt.Sprintf(
		"Пользователь хочет разобрать психологическую технику.\n\nТехника: %s\n\nОписание техники:\n%s\n\nПомоги пользователю:\n— объяснить технику\n— разобрать ситуацию через неё\n— задать вопросы\n— провести через практику.\n\nНачни с краткого объяснения смысла техники простым языком и задай 1–2 уточняющих вопроса по его ситуации.",
		strings.TrimSpace(techniqueTitle),
		strings.TrimSpace(techniqueDescription),
	)

	resp, userErr := openai.ChatCompletion(
		context.Background(),
		apiKey,
		openai.Request{
			Model: openai.DefaultModel,
			Messages: []openai.Message{
				{Role: "system", Content: systemPrompt},
				{Role: "user", Content: contextPrompt},
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
		text = "Давай разберём эту технику вместе. Опиши, пожалуйста, свою ситуацию или вопрос, с которым ты хочешь поработать."
	}
	if len(text) > maxReplyLen {
		text = text[:maxReplyLen-3] + "..."
	}

	// сохраняем/обнуляем сессию: system + контекст техники (как user) + первое сообщение ассистента
	saveSession(chatID, []openai.Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: contextPrompt},
		{Role: "assistant", Content: text},
	})

	msg := tgbotapi.NewMessage(chatID, text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🛑 Завершить диалог", "question_end"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending technique question message: %v", err)
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
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🛑 Завершить диалог", "question_end"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending question dialog message: %v", err)
	}

	return true
}

func sendFallback(bot *tgbotapi.BotAPI, chatID int64, text string) {
	msg := tgbotapi.NewMessage(chatID, text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🛑 Завершить диалог", "question_end"),
		),
	)
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

// EndSession завершает диалог «Вопрос» для чата (очищает историю).
func EndSession(chatID int64) {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()

	delete(sessions, chatID)
}
