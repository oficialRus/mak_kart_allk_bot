package handlers

import (
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"mak_kart_bot/internal/keyboards"
)

type AIPsychologistHandler struct {
	bot *tgbotapi.BotAPI
}

func NewAIPsychologistHandler(bot *tgbotapi.BotAPI) *AIPsychologistHandler {
	return &AIPsychologistHandler{bot: bot}
}

func (h *AIPsychologistHandler) Handle(chatID int64, messageID int) {
	text := "🧠 *ИИ Психолог-коуч*\n\n_Этот раздел находится в разработке._"
	edit := tgbotapi.NewEditMessageText(chatID, messageID, text)
	edit.ParseMode = "Markdown"
	kb := keyboards.BackToMainMenu()
	edit.ReplyMarkup = &kb
	h.bot.Send(edit)
}
