package card_decode

import (
	"log"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

// Handle обрабатывает раздел «Расшифровка карты».
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	text := `Здесь вы можете получить расшифровку метафорической карты.

Отправьте фотографию своей карты — и ИИ-психолог поможет
понять её послание и скрытые смыслы.

Можно отправить до 3 карт одновременно.

Бот:
— анализирует каждую карту
— разбирает её с ассоциативной точки зрения
— делает общий психологический вывод
— подсказывает возможные действия и направление для размышлений

Прикрепите фотографию карты прямо в этот диалог.`

	msg := tgbotapi.NewMessage(chatID, text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_next"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🏠 Главное меню", "ai_coach_main_menu"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending card decode message: %v", err)
	}
}

