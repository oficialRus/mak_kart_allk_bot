package keyboards

import tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"

const (
	CallbackAIPsychologist = "menu:ai_psychologist"
	CallbackEducation      = "menu:education"
	CallbackContacts       = "menu:contacts"
	CallbackShop           = "menu:shop"
	CallbackBack           = "menu:back"
)

func MainMenu() tgbotapi.InlineKeyboardMarkup {
	return tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🧠 ИИ Психолог-коуч", CallbackAIPsychologist),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("📚 Обучение", CallbackEducation),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("📞 Контакты", CallbackContacts),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🛍 Магазин", CallbackShop),
		),
	)
}

func BackToMainMenu() tgbotapi.InlineKeyboardMarkup {
	return tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("← Главное меню", CallbackBack),
		),
	)
}
