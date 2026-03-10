package shop

import (
	"log"
	"os"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

const (
	// Локальное изображение для раздела «Магазин».
	shopImagePath = "cmd/bot/images/shop.png"
	// Подпись к картинке.
	shopCaption    = "Магазин — здесь вы можете выбрать товары и услуги."
	defaultShopURL = "https://example.com/shop" // замените на свой URL или задайте SHOP_URL в .env
)

// Handle обрабатывает нажатие на кнопку «Магазин»: отправляет картинку раздела
// и кнопку «Перейти в магазин».
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	shopURL := strings.TrimSpace(os.Getenv("SHOP_URL"))
	if shopURL == "" {
		shopURL = defaultShopURL
	}

	keyboard := tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonURL("🛒 Перейти в магазин", shopURL),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🏠 Главное меню", "ai_coach_main_menu"),
		),
	)
	photo := tgbotapi.NewPhoto(chatID, tgbotapi.FilePath(shopImagePath))
	photo.Caption = shopCaption
	photo.ReplyMarkup = keyboard
	if _, err := bot.Send(photo); err != nil {
		log.Printf("ERROR sending shop image, fallback to text: %v", err)
		msg := tgbotapi.NewMessage(chatID, shopCaption)
		msg.ReplyMarkup = keyboard
		if _, err2 := bot.Send(msg); err2 != nil {
			log.Printf("ERROR sending shop fallback message: %v", err2)
		}
	}
}
