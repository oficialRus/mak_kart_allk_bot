package handlers

import (
	"context"
	"fmt"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"mak_kart_bot/internal/config"
	"mak_kart_bot/internal/keyboards"
	"mak_kart_bot/internal/middleware"
)

type StartHandler struct {
	bot        *tgbotapi.BotAPI
	cfg        *config.Config
	userMiddle *middleware.UserMiddleware
}

func NewStartHandler(bot *tgbotapi.BotAPI, cfg *config.Config, um *middleware.UserMiddleware) *StartHandler {
	return &StartHandler{bot: bot, cfg: cfg, userMiddle: um}
}

func (h *StartHandler) Handle(update tgbotapi.Update) {
	if update.Message == nil {
		return
	}

	msg := update.Message
	ctx := context.Background()

	h.userMiddle.EnsureUser(ctx, msg.From)

	text := fmt.Sprintf(
		"Привет, %s! 👋\n\n"+
			"Я — твой помощник в мире МАК-карт и психологии 🃏\n\n"+
			"Прежде чем начать, давай я узнаю немного о тебе. "+
			"Для этого нужно пройти небольшой опросник — это займёт всего пару минут.\n\n"+
			"Он поможет мне подобрать для тебя подходящий контент и формат работы.",
		msg.From.FirstName,
	)

	keyboard := tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonWebApp(
				"📋 Пройти опросник",
				tgbotapi.WebAppInfo{URL: h.cfg.WebAppURL},
			),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Пропустить →", "quiz:skip"),
		),
	)

	reply := tgbotapi.NewMessage(msg.Chat.ID, text)
	reply.ReplyMarkup = keyboard
	h.bot.Send(reply)
}
