package card_day

import (
	"log"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

// Handle обрабатывает раздел «Карта дня».
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	msg := tgbotapi.NewMessage(chatID, "Раздел «Карта дня» в разработке. Здесь будет подсказка дня в формате карты.")
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending card day message: %v", err)
	}
}

