package card_day

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"

	"mak_kart_allk_bot/internal/repository"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

const defaultExclusionDays = 14

// Handle показывает вступительное сообщение раздела «Карта дня» с кнопкой получения.
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	text := `Каждый день карта может подсказать новое направление,
дать мотивацию и помочь увидеть ситуацию по-другому.

Нажмите кнопку ниже, чтобы получить свою карту дня.`

	msg := tgbotapi.NewMessage(chatID, text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Получить карту дня", "card_day_get"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending card day message: %v", err)
	}
}

// HandleGet обрабатывает нажатие «Получить карту дня»:
// назначает пользователю карту на сегодня (или возвращает уже назначенную)
// и отправляет изображение карты.
func HandleGet(bot *tgbotapi.BotAPI, chatID int64, userID int64) {
	exclusionDays := defaultExclusionDays
	if v := os.Getenv("CARD_DAY_EXCLUSION_DAYS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			exclusionDays = n
		}
	}

	ctx := context.Background()
	card, err := repository.GetOrAssignCardOfDay(ctx, userID, exclusionDays)
	if err != nil {
		log.Printf("ERROR card_day_get user=%d: %v", userID, err)
		msg := tgbotapi.NewMessage(chatID, "Произошла ошибка при получении карты дня. Попробуйте позже.")
		bot.Send(msg)
		return
	}

	if card == nil {
		msg := tgbotapi.NewMessage(chatID, "Карты дня пока не загружены. Загляните позже!")
		msg.ReplyMarkup = backKeyboard()
		bot.Send(msg)
		return
	}

	caption := buildCaption(card)
	keyboard := backKeyboard()

	photo := tgbotapi.NewPhoto(chatID, tgbotapi.FilePath(card.ImagePath))
	photo.Caption = caption
	photo.ReplyMarkup = keyboard

	if _, err := bot.Send(photo); err != nil {
		log.Printf("ERROR sending card day photo (path=%s): %v", card.ImagePath, err)
		msg := tgbotapi.NewMessage(chatID, caption)
		msg.ReplyMarkup = keyboard
		bot.Send(msg)
	}
}

func buildCaption(card *repository.CardDayCard) string {
	caption := ""
	if card.Title != "" {
		caption = fmt.Sprintf("🗓️ %s", card.Title)
	}
	if card.Description != "" {
		if caption != "" {
			caption += "\n\n"
		}
		caption += card.Description
	}
	if caption == "" {
		caption = "🗓️ Ваша карта дня"
	}
	return caption
}

func backKeyboard() tgbotapi.InlineKeyboardMarkup {
	return tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach"),
		),
	)
}
