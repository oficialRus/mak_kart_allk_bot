package handlers

import (
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"mak_kart_bot/internal/keyboards"
)

type MainMenuHandler struct {
	bot *tgbotapi.BotAPI
}

func NewMainMenuHandler(bot *tgbotapi.BotAPI) *MainMenuHandler {
	return &MainMenuHandler{bot: bot}
}

func (h *MainMenuHandler) SendMenu(chatID int64, messageID int) {
	text := "🏠 *Главное меню*\n\nВыбери раздел:"

	edit := tgbotapi.NewEditMessageText(chatID, messageID, text)
	edit.ParseMode = "Markdown"
	edit.ReplyMarkup = func() *tgbotapi.InlineKeyboardMarkup {
		kb := keyboards.MainMenu()
		return &kb
	}()
	h.bot.Send(edit)
}

func (h *MainMenuHandler) SendMenuAsNew(chatID int64) {
	text := "🏠 *Главное меню*\n\nВыбери раздел:"
	msg := tgbotapi.NewMessage(chatID, text)
	msg.ParseMode = "Markdown"
	kb := keyboards.MainMenu()
	msg.ReplyMarkup = kb
	h.bot.Send(msg)
}
