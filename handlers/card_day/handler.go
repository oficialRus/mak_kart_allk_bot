package card_day

import (
	"log"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

// Handle обрабатывает раздел «Карта дня».
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	text := `Каждый день карта может подсказать новое направление,
дать мотивацию и помочь увидеть ситуацию по-другому.

Нажмите кнопку ниже, чтобы получить свою карту дня.`

	msg := tgbotapi.NewMessage(chatID, text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Получить карту дня", "card_day_get"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending card day message: %v", err)
	}
}

