package shop

import (
	"log"
	"os"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

const (
	shopPlaceholderURL = "https://placehold.co/600x400/1e3a5f/eee/png?text=Магазин"
	shopCaption        = "Магазин — здесь вы можете выбрать товары и услуги."
	defaultShopURL     = "https://example.com/shop" // замените на свой URL или задайте SHOP_URL в .env
)

// Handle обрабатывает нажатие на кнопку «Магазин»: отправляет фото-заглушку
// и кнопку «Перейти в магазин».
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	shopURL := strings.TrimSpace(os.Getenv("SHOP_URL"))
	if shopURL == "" {
		shopURL = defaultShopURL
	}

	photo := tgbotapi.NewPhoto(chatID, tgbotapi.FileURL(shopPlaceholderURL))
	photo.Caption = shopCaption
	photo.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonURL("Перейти в магазин", shopURL),
		),
	)
	if _, err := bot.Send(photo); err != nil {
		log.Printf("ERROR sending shop message: %v", err)
	}
}
