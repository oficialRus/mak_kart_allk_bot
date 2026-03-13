package card_day

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"mak_kart_allk_bot/handlers/question"
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
		return
	}

	// Через 6 секунд отправляем короткий подсказочный текст от имени ИИ‑психолога.
	go func() {
		time.Sleep(6 * time.Second)

		text := "**На обратной стороне — ИИ‑психолог.**\n\n" +
			"Он поможет вам разобраться с картой и ответить на ваши вопросы.\n\n" +
			"Например:\n" +
			"• Что больше всего привлекло мое внимание на карте?\n" +
			"• Что я чувствую, глядя на эту карту?\n" +
			"• Как это связано с моим запросом?"

		msg := tgbotapi.NewMessage(chatID, text)
		msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("🏠 Главное меню", "ai_coach_main_menu"),
			),
		)
		if _, err := bot.Send(msg); err != nil {
			log.Printf("ERROR sending follow-up card day message: %v", err)
			return
		}

		// После этого сообщения пользователь может сразу писать ИИ‑психологу.

		// Передаём ИИ‑психологу скрытый контекст о выпавшей карте дня,
		// чтобы он изначально знал, вокруг какой карты строится диалог.
		cardContext := "Пользователь только что получил карту дня и рассматривает её. " +
			"Помогай ему разбирать чувства, ассоциации и вопросы именно по этой карте.\n\n"
		if card.Title != "" {
			cardContext += fmt.Sprintf("Название карты: %s\n", card.Title)
		}
		if card.Description != "" {
			cardContext += fmt.Sprintf("Описание карты:\n%s\n", card.Description)
		}

		question.StartSilentSession(bot, chatID, cardContext)
	}()
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
		caption = "**Как работать с этой картой**\n\n" +
			"Каждая карта может подсказать вам что‑то важное и подсветить ситуацию с новой стороны. " +
			"Посмотрите внимательно на изображение: какие чувства, ассоциации, воспоминания и догадки возникают у вас сразу? " +
			"Не отбрасывайте первые импульсы — именно в них часто скрыт главный смысл.\n\n" +
			"Попробуйте «зафиксировать» всё, что приходит: вслух, в заметках или хотя бы мысленно, максимально ясно и конкретно. " +
			"По мере того как вы проговариваете свои ощущения и мысли, ответ на ваш вопрос обычно начинает проявляться сам собой.\n\n" +
			"Иногда решение лежит на поверхности, иногда — прячется в деталях. " +
			"Доверяйте своим ассоциациям и внутренним образам: чем внимательнее вы к ним отнесётесь, тем глубже будет ваша личная трактовка карты."
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
