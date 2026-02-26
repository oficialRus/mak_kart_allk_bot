package number_day

import (
	"log"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

// Handle обрабатывает раздел «Цифра дня».
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	msg := tgbotapi.NewMessage(chatID, "Раздел «Цифра дня» в разработке. Здесь появится персональная цифровая подсказка на день.")
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending number day message: %v", err)
	}
}

