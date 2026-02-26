package mainmenu

import (
	"log"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

// Handle рисует главное меню.
// miniappURL — адрес мини-приложения «Цифра дня».
func Handle(bot *tgbotapi.BotAPI, chatID int64, miniappURL string) {
	buttonURL := miniappURL
	if strings.Contains(miniappURL, "localhost") {
		buttonURL = "https://example.com"
	}

	msg := tgbotapi.NewMessage(chatID, "Главное меню. Выберите раздел:")
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("ИИ-психолог Коуч", "main_menu_ai"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonURL("Цифра дня", buttonURL),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Обучение", "main_menu_education"),
			tgbotapi.NewInlineKeyboardButtonData("Контакты", "main_menu_contacts"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Магазин", "main_menu_shop"),
			tgbotapi.NewInlineKeyboardButtonData("Личный кабинет", "main_menu_cabinet"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending main menu: %v", err)
	}
}
