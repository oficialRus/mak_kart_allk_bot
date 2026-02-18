package handlers

import (
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"mak_kart_bot/internal/keyboards"
)

type ShopHandler struct {
	bot *tgbotapi.BotAPI
}

func NewShopHandler(bot *tgbotapi.BotAPI) *ShopHandler {
	return &ShopHandler{bot: bot}
}

func (h *ShopHandler) Handle(chatID int64, messageID int) {
	text := "🛍 *Магазин*\n\n_Этот раздел находится в разработке._"
	edit := tgbotapi.NewEditMessageText(chatID, messageID, text)
	edit.ParseMode = "Markdown"
	kb := keyboards.BackToMainMenu()
	edit.ReplyMarkup = &kb
	h.bot.Send(edit)
}
