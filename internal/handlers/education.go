package handlers

import (
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"mak_kart_bot/internal/keyboards"
)

type EducationHandler struct {
	bot *tgbotapi.BotAPI
}

func NewEducationHandler(bot *tgbotapi.BotAPI) *EducationHandler {
	return &EducationHandler{bot: bot}
}

func (h *EducationHandler) Handle(chatID int64, messageID int) {
	text := "📚 *Обучение*\n\n_Этот раздел находится в разработке._"
	edit := tgbotapi.NewEditMessageText(chatID, messageID, text)
	edit.ParseMode = "Markdown"
	kb := keyboards.BackToMainMenu()
	edit.ReplyMarkup = &kb
	h.bot.Send(edit)
}
