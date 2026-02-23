package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"strconv"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"github.com/joho/godotenv"
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
	// URL мини-приложения (тест). После деплоя mini_app подставьте свой HTTPS-адрес.
	miniappURL := strings.TrimSpace(os.Getenv("MINI_APP_URL"))
	if miniappURL == "" {
		miniappURL = "https://localhost:5173/"
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

		// Нажатие inline-кнопки
		if update.CallbackQuery != nil {
			handleCallback(bot, update.CallbackQuery, miniappURL, token)
			continue
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
	msg := tgbotapi.NewMessage(chatID, "Здравствуйте! Мы рады вас видеть! Выберите одну из кнопок ниже.")
	keyboard := tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("ИИ Психолог-Коуч", "ai_coach"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Обратная связь", "feedback"),
			tgbotapi.NewInlineKeyboardButtonData("Подарок", "gift"),
		),
	)
	msg.ReplyMarkup = keyboard

	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending start message: %v", err)
		return
	}
	log.Printf("Sent start message to chat %d", chatID)
}

const (
	feedbackURL       = "https://t.me/RyslanNovikov"
	giftImageURL      = "https://placehold.co/600x400/eee/333/png?text=Подарок+от+психолога" // заглушка картинки
	giftCaption       = "🎁 Ваш подарок от психолога — короткий тест, который поможет лучше понять себя. Нажмите «Мини рулетка» или перейдите далее."
	giftWhyText       = "Этот тест помогает определить ваш текущий уровень и подобрать подходящие материалы. Займёт пару минут и даст персональную рекомендацию."
)

func handleCallback(bot *tgbotapi.BotAPI, q *tgbotapi.CallbackQuery, miniappURL, token string) {
	chatID := q.Message.Chat.ID
	callbackID := q.ID

	switch q.Data {
	case "feedback":
		text := "У вас возникла проблема с товаром или есть другой вопрос? Напишите сюда — решим ваш вопрос:\n\n" + feedbackURL
		msg := tgbotapi.NewMessage(chatID, text)
		msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonURL("Написать в Telegram", feedbackURL),
			),
		)
		if _, err := bot.Send(msg); err != nil {
			log.Printf("ERROR sending feedback message: %v", err)
		}
	case "gift":
		sendGiftMessage(bot, chatID, miniappURL, token)
	case "gift_why":
		_, _ = bot.Send(tgbotapi.NewMessage(chatID, giftWhyText))
	case "gift_back":
		handleStart(bot, chatID)
	case "gift_next":
		sendMainMenu(bot, chatID, miniappURL)
	case "main_menu_back":
		sendGiftMessage(bot, chatID, miniappURL, token)
	case "ai_coach":
		_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Раздел «ИИ Психолог-Коуч» в разработке. Скоро здесь будет чат с психологом-коучем."))
	case "main_menu_ai", "main_menu_education", "main_menu_contacts", "main_menu_shop":
		_, _ = bot.Request(tgbotapi.NewCallback(callbackID, "Скоро здесь будет раздел."))
		return
	default:
		_, _ = bot.Request(tgbotapi.NewCallback(callbackID, ""))
		return
	}

	_, _ = bot.Request(tgbotapi.NewCallback(callbackID, ""))
}

// Под фото — две кнопки: «Открыть тест», «Далее».
func sendGiftMessage(_ *tgbotapi.BotAPI, chatID int64, miniappURL, token string) {
	buttonURL := miniappURL
	if strings.Contains(miniappURL, "localhost") {
		buttonURL = "https://example.com"
	}
	replyMarkup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{{"text": "Мини рулетка", "web_app": map[string]string{"url": buttonURL}}},
			{{"text": "Далее", "callback_data": "gift_next"}},
		},
	}
	markupJSON, _ := json.Marshal(replyMarkup)

	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	_ = w.WriteField("chat_id", strconv.FormatInt(chatID, 10))
	_ = w.WriteField("photo", giftImageURL)
	_ = w.WriteField("caption", giftCaption)
	_ = w.WriteField("reply_markup", string(markupJSON))
	_ = w.Close()

	req, err := http.NewRequest(http.MethodPost, "https://api.telegram.org/bot"+token+"/sendPhoto", body)
	if err != nil {
		log.Printf("ERROR sendGiftMessage request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "multipart/form-data; boundary="+w.Boundary())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("ERROR sendGiftMessage: %v", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		log.Printf("ERROR sendPhoto response: %d %s", resp.StatusCode, string(b))
	}
}

// Главное меню после «Далее»: Мини рулетка, ИИ-психолог Коуч, Обучение, Контакты, Магазин, Назад.
func sendMainMenu(bot *tgbotapi.BotAPI, chatID int64, miniappURL string) {
	buttonURL := miniappURL
	if strings.Contains(miniappURL, "localhost") {
		buttonURL = "https://example.com"
	}
	msg := tgbotapi.NewMessage(chatID, "Главное меню. Выберите раздел:")
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonURL("Мини рулетка", buttonURL),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("ИИ-психолог Коуч", "main_menu_ai"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Обучение", "main_menu_education"),
			tgbotapi.NewInlineKeyboardButtonData("Контакты", "main_menu_contacts"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Магазин", "main_menu_shop"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Назад", "main_menu_back"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending main menu: %v", err)
	}
}
