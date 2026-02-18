package main

import (
	"context"
	"log"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"mak_kart_bot/internal/config"
	"mak_kart_bot/internal/db"
	"mak_kart_bot/internal/handlers"
	"mak_kart_bot/internal/keyboards"
	"mak_kart_bot/internal/middleware"
	"mak_kart_bot/internal/repository"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	database, err := db.Connect(cfg.DatabaseDSN)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer database.Close()

	if err := db.RunMigrations(cfg.DatabaseDSN); err != nil {
		log.Fatalf("migrations: %v", err)
	}
	log.Println("Migrations applied successfully")

	bot, err := tgbotapi.NewBotAPI(cfg.BotToken)
	if err != nil {
		log.Fatalf("bot init: %v", err)
	}
	log.Printf("Bot started: @%s", bot.Self.UserName)

	userRepo := repository.NewUserRepository(database)
	userMiddle := middleware.NewUserMiddleware(userRepo)

	startH := handlers.NewStartHandler(bot, cfg, userMiddle)
	mainMenuH := handlers.NewMainMenuHandler(bot)
	aiH := handlers.NewAIPsychologistHandler(bot)
	eduH := handlers.NewEducationHandler(bot)
	contactsH := handlers.NewContactsHandler(bot)
	shopH := handlers.NewShopHandler(bot)

	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60
	updates := bot.GetUpdatesChan(u)

	log.Println("Listening for updates...")

	for update := range updates {
		go handleUpdate(update, bot, userMiddle, startH, mainMenuH, aiH, eduH, contactsH, shopH)
	}
}

func handleUpdate(
	update tgbotapi.Update,
	bot *tgbotapi.BotAPI,
	userMiddle *middleware.UserMiddleware,
	startH *handlers.StartHandler,
	mainMenuH *handlers.MainMenuHandler,
	aiH *handlers.AIPsychologistHandler,
	eduH *handlers.EducationHandler,
	contactsH *handlers.ContactsHandler,
	shopH *handlers.ShopHandler,
) {
	// Команда /start
	if update.Message != nil && update.Message.IsCommand() {
		switch update.Message.Command() {
		case "start":
			startH.Handle(update)
		}
		return
	}

	// Callback кнопки
	if update.CallbackQuery != nil {
		cb := update.CallbackQuery
		chatID := cb.Message.Chat.ID
		msgID := cb.Message.MessageID

		userMiddle.EnsureUser(context.Background(), cb.From)

		bot.Request(tgbotapi.NewCallback(cb.ID, ""))

		switch cb.Data {
		case "quiz:skip":
			mainMenuH.SendMenu(chatID, msgID)

		case keyboards.CallbackAIPsychologist:
			aiH.Handle(chatID, msgID)

		case keyboards.CallbackEducation:
			eduH.Handle(chatID, msgID)

		case keyboards.CallbackContacts:
			contactsH.Handle(chatID, msgID)

		case keyboards.CallbackShop:
			shopH.Handle(chatID, msgID)

		case keyboards.CallbackBack:
			mainMenuH.SendMenu(chatID, msgID)
		}
	}
}
