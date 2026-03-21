package api

import (
	"context"
	"log"
	"strings"
	"unicode/utf8"

	"mak_kart_allk_bot/openai"
)

const cardDayMessageSystem = `Ты психолог-наставник, работаешь с метафорическими ассоциативными картами.

Сгенерируй короткое персональное «послание на день» по названию и описанию карты. Если описание пустое — опирайся на название и общий смысл МАК.

Требования:
- 3–5 предложений, тёплый поддерживающий тон
- свяжи образ карты с вниманием к себе и одним маленьким шагом на сегодня
- без нумерологии и без медицинских диагнозов
- без приветствий «доброе утро/вечер» — человек может зайти в любое время
- не повторяй дословно название в каждом предложении
- только текст послания, без заголовков и маркированных списков`

func generateCardDayMessageText(ctx context.Context, apiKey, title, description string) string {
	title = strings.TrimSpace(title)
	desc := strings.TrimSpace(description)
	userPart := "Название карты: " + title
	if desc != "" {
		userPart += "\n\nОписание / образ карты:\n" + desc
	}
	userPart += "\n\nНапиши послание на день для человека, которому выпала эта карта."

	resp, uerr := openai.ChatCompletion(ctx, apiKey, openai.Request{
		Model: openai.DefaultModel,
		Messages: []openai.Message{
			{Role: "system", Content: cardDayMessageSystem},
			{Role: "user", Content: userPart},
		},
	})
	if uerr != nil {
		log.Printf("api card-day: OpenAI day_message: %v", uerr)
		return ""
	}
	if len(resp.Choices) == 0 {
		return ""
	}
	return strings.TrimSpace(resp.Choices[0].Message.Content)
}

// fallbackCardDayMessage — если ИИ недоступен: текст из описания карты или шаблон по названию.
func fallbackCardDayMessage(title, description string) string {
	title = strings.TrimSpace(title)
	desc := strings.TrimSpace(description)
	if desc != "" {
		const maxRunes = 420
		if utf8.RuneCountInString(desc) > maxRunes {
			runes := []rune(desc)
			return strings.TrimSpace(string(runes[:maxRunes])) + "…"
		}
		return desc
	}
	if title != "" {
		return "Сегодняшняя карта — «" + title + "». Позвольте образу побыть с вами: что он подсвечивает в настроении и в том, что вы откладываете? Выберите один маленький, бережный шаг к себе — без давления, как лёгкий эксперимент на день."
	}
	return "Позвольте образу на карте побыть с вами: заметьте детали, дыхание и одну мысль, которая приходит без спешки. Сегодня можно двигаться маленьким шагом и с уважением к своему темпу."
}
