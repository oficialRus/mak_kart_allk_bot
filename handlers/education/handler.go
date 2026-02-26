package education

import (
	"log"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

const (
	educationPlaceholderURL = "https://placehold.co/600x400/2d3a4e/eee/png?text=Обучение"
	educationDescription    = "Раздел «Обучение» — здесь вы найдёте обучающие материалы, уроки и практики от психолога. Они помогут лучше понимать себя, развивать навыки и применять знания в жизни. Выберите тему ниже или вернитесь в меню."
)

// Handle обрабатывает нажатие на кнопку «Обучение»: отправляет фото-заглушку,
// описание раздела и кнопку «Назад».
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	photo := tgbotapi.NewPhoto(chatID, tgbotapi.FileURL(educationPlaceholderURL))
	photo.Caption = educationDescription
	photo.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Пройти опрос", "education_survey")),
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Назад", "ai_coach_main_menu")),
	)
	if _, err := bot.Send(photo); err != nil {
		log.Printf("ERROR sending education message: %v", err)
	}
}
