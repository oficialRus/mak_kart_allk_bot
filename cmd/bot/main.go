package main

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

func main() {
	// Пробуем загрузить .env из текущей папки и из родительской (если запуск из cmd/bot)
	for _, path := range []string{".env", "../.env"} {
		if err := godotenv.Load(path); err == nil {
			log.Printf("Loaded env from %s", path)
			break
		}
	}

	token := strings.TrimSpace(os.Getenv("BOT_TOKEN"))
	if token == "" {
		log.Fatal("BOT_TOKEN is not set. Проверьте .env в корне проекта и переменную BOT_TOKEN.")
	}

	log.Println("Connecting to Telegram...")

	bot, err := tgbotapi.NewBotAPI(token)
	if err != nil {
		log.Fatalf("bot init: %v", err)
	}
	log.Printf("Bot started: @%s", bot.Self.UserName)

	// Снимаем webhook, иначе апдейты уходят на URL, а не в GetUpdates.
	if resp, err := bot.Request(tgbotapi.DeleteWebhookConfig{}); err != nil {
		log.Printf("WARNING: deleteWebhook failed: %v", err)
	} else if !resp.Ok {
		log.Printf("WARNING: deleteWebhook not OK: %s", resp.Description)
	} else {
		log.Println("Webhook removed OK")
	}

	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60
	updates := bot.GetUpdatesChan(u)

	log.Println("Listening for updates...")

	for update := range updates {
		// Диагностика: видим любой входящий апдейт
		switch {
		case update.Message != nil:
			log.Printf("[update %d] Message: chat=%d text=%q", update.UpdateID, update.Message.Chat.ID, update.Message.Text)
		case update.CallbackQuery != nil:
			log.Printf("[update %d] CallbackQuery: data=%s", update.UpdateID, update.CallbackQuery.Data)
		default:
			log.Printf("[update %d] (other)", update.UpdateID)
		}

		if update.Message == nil {
			continue
		}
		// /start как команда или просто текст "/start" (например из deep link)
		isStart := (update.Message.IsCommand() && update.Message.Command() == "start") ||
			update.Message.Text == "/start" || (len(update.Message.Text) >= 6 && update.Message.Text[:6] == "/start")
		if isStart {
			log.Printf("Received /start from chat %d", update.Message.Chat.ID)
			handleStart(bot, update.Message.Chat.ID)
		}
	}
}

func handleStart(bot *tgbotapi.BotAPI, chatID int64) {
	msg := tgbotapi.NewMessage(chatID, "Привет, дорогой друг! Мы рады вас видеть! Выберите одну из кнопок ниже.")
	keyboard := tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Обратная связь", "feedback"),
			tgbotapi.NewInlineKeyboardButtonData("Вам подарок от психолога", "gift"),
		),
	)
	msg.ReplyMarkup = keyboard

	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending start message: %v", err)
		return
	}
	log.Printf("Sent start message to chat %d", chatID)
}
