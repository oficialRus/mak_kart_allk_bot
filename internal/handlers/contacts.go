package handlers

import (
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"mak_kart_bot/internal/keyboards"
)

type ContactsHandler struct {
	bot *tgbotapi.BotAPI
}

func NewContactsHandler(bot *tgbotapi.BotAPI) *ContactsHandler {
	return &ContactsHandler{bot: bot}
}

func (h *ContactsHandler) Handle(chatID int64, messageID int) {
	text := "📞 *Контакты*\n\n_Этот раздел находится в разработке._"
	edit := tgbotapi.NewEditMessageText(chatID, messageID, text)
	edit.ParseMode = "Markdown"
	kb := keyboards.BackToMainMenu()
	edit.ReplyMarkup = &kb
	h.bot.Send(edit)
}
