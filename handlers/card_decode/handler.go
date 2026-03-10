package card_decode

import (
	"context"
	"log"
	"os"
	"strings"
	"sync"

	"mak_kart_allk_bot/openai"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

var (
	waitMu        sync.Mutex
	waitingForPhoto = make(map[int64]bool)
)

// StartWaitingPhoto помечает чат как ожидающий фото карты.
func StartWaitingPhoto(chatID int64) {
	waitMu.Lock()
	defer waitMu.Unlock()
	waitingForPhoto[chatID] = true
}

// StopWaitingPhoto снимает ожидание фото для чата.
func StopWaitingPhoto(chatID int64) {
	waitMu.Lock()
	defer waitMu.Unlock()
	delete(waitingForPhoto, chatID)
}

// IsWaitingPhoto возвращает, ждём ли сейчас фото от этого чата.
func IsWaitingPhoto(chatID int64) bool {
	waitMu.Lock()
	defer waitMu.Unlock()
	return waitingForPhoto[chatID]
}

// Handle обрабатывает раздел «Расшифровка карты».
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	text := `Здесь вы можете получить расшифровку метафорической карты.

Отправьте фотографию своей карты — и ИИ-психолог поможет
понять её послание и скрытые смыслы.

Можно отправить до 3 карт одновременно.

Бот:
— анализирует каждую карту
— разбирает её с ассоциативной точки зрения
— делает общий психологический вывод
— подсказывает возможные действия и направление для размышлений

Прикрепите фотографию карты прямо в этот диалог.`

	msg := tgbotapi.NewMessage(chatID, text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("📷 Отправить фото", "card_decode_wait_photo"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_main_menu"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🏠 Главное меню", "ai_coach_main_menu"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending card decode message: %v", err)
	}
}

// HandlePhoto обрабатывает фото карты: отправляет изображение в ИИ и присылает расшифровку.
func HandlePhoto(bot *tgbotapi.BotAPI, chatID int64, token string, photos []tgbotapi.PhotoSize) {
	if len(photos) == 0 {
		return
	}

	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		msg := tgbotapi.NewMessage(chatID, "ИИ-расшифровка карты временно недоступна. Проверьте настройку OPENAI_API_KEY.")
		if _, err := bot.Send(msg); err != nil {
			log.Printf("ERROR sending card decode no api key: %v", err)
		}
		return
	}

	// Берём самое большое по размеру изображение
	photo := photos[len(photos)-1]
	file, err := bot.GetFile(tgbotapi.FileConfig{FileID: photo.FileID})
	if err != nil {
		log.Printf("ERROR get file for card decode: %v", err)
		msg := tgbotapi.NewMessage(chatID, "Не удалось получить изображение карты. Попробуйте отправить фото ещё раз.")
		_, _ = bot.Send(msg)
		return
	}

	imageURL := "https://api.telegram.org/file/bot" + token + "/" + file.FilePath

	prompt := "На изображении метафорическая (ассоциативная) карта. Опиши, пожалуйста, что ты видишь и какое психологическое послание может нести эта карта для человека. Укажи ключевые ассоциации, возможные внутренние состояния и мягко предложи шаги или вопросы для размышления."

	resp, userErr := openai.ChatCompletionWithImage(context.Background(), apiKey, prompt, imageURL)
	if userErr != nil {
		msg := tgbotapi.NewMessage(chatID, userErr.Text)
		msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("🛑 Завершить диалог", "question_end"),
			),
		)
		if _, err := bot.Send(msg); err != nil {
			log.Printf("ERROR sending card decode user error: %v", err)
		}
		return
	}

	text := ""
	if len(resp.Choices) > 0 {
		text = strings.TrimSpace(resp.Choices[0].Message.Content)
	}
	if text == "" {
		text = "Я не смог подробно расшифровать эту карту. Попробуйте отправить другое фото или опишите словами, что на ней изображено."
	}

	msg := tgbotapi.NewMessage(chatID, text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🛑 Завершить диалог", "question_end"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending card decode AI reply: %v", err)
	}
}

