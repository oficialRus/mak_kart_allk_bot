package main

import (
	"log"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"mak_kart_bot/internal/config"
	"mak_kart_bot/internal/handlers"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	bot, err := tgbotapi.NewBotAPI(cfg.BotToken)
	if err != nil {
		log.Fatalf("bot init: %v", err)
	}
	log.Printf("Bot started: @%s", bot.Self.UserName)

	startH := handlers.NewStartHandler(bot)

	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60
	updates := bot.GetUpdatesChan(u)

	log.Println("Listening for updates...")

	for update := range updates {
		if update.Message != nil && update.Message.IsCommand() && update.Message.Command() == "start" {
			startH.Handle(update)
		}
	}
}
