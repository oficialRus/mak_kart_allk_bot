package technique

import (
	"log"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

// Картинка-заглушка для раздела «Техника». Можно заменить на свой URL через .env.
const techniquePlaceholderURL = "https://placehold.co/600x400/2d1b4e/eee/png?text=Техника"

// Handle обрабатывает нажатие на кнопку «Техника»: отправляет картинку-заглушку
// и список inline-кнопок в столбик (Техника_1 … Техника_5).
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	photo := tgbotapi.NewPhoto(chatID, tgbotapi.FileURL(techniquePlaceholderURL))
	photo.Caption = "Выберите технику:"

	photo.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Техника_1", "technique_1")),
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Техника_2", "technique_2")),
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Техника_3", "technique_3")),
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Техника_4", "technique_4")),
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Техника_5", "technique_5")),
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Назад", "ai_coach_next")),
	)

	if _, err := bot.Send(photo); err != nil {
		log.Printf("ERROR sending technique message: %v", err)
	}
}
