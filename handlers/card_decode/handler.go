package card_decode

import (
	"log"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

// Handle обрабатывает раздел «Расшифровка карты».
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	msg := tgbotapi.NewMessage(chatID, "Раздел «Расшифровка карты» в разработке. Здесь будет разбор вашей карты и подсказки по значениям.")
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending card decode message: %v", err)
	}
}

