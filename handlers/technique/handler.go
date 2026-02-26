package technique

import (
	"log"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

// Handle обрабатывает раздел «Техника».
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	msg := tgbotapi.NewMessage(chatID, "Раздел «Техника» в разработке. Здесь появятся практические упражнения и техники для работы с запросом.")
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending technique message: %v", err)
	}
}

