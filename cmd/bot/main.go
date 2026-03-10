package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"mak_kart_allk_bot/handlers/cabinet"
	"mak_kart_allk_bot/handlers/card_day"
	"mak_kart_allk_bot/handlers/card_decode"
	"mak_kart_allk_bot/handlers/education"
	"mak_kart_allk_bot/handlers/mainmenu"
	"mak_kart_allk_bot/handlers/number_day"
	"mak_kart_allk_bot/handlers/question"
	"mak_kart_allk_bot/handlers/shop"
	"mak_kart_allk_bot/handlers/technique"
	"mak_kart_allk_bot/internal/api"
	"mak_kart_allk_bot/internal/db"

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

	// Инициализируем подключение к PostgreSQL.
	if err := db.InitFromEnv(); err != nil {
		log.Fatalf("db init: %v", err)
	}
	log.Println("DB connected OK")

	if err := db.EnsureProfileTable(context.Background()); err != nil {
		log.Fatalf("db ensure profile table: %v", err)
	}
	log.Println("DB profile table OK")

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

	// HTTP API для мини‑приложения (сохранение профиля: ФИО, дата рождения, Telegram ID).
	apiPort := strings.TrimSpace(os.Getenv("API_PORT"))
	if apiPort == "" {
		apiPort = "8080"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/profile", api.ProfileHandler(token))
	go func() {
		log.Printf("API listening on :%s", apiPort)
		if err := http.ListenAndServe(":"+apiPort, mux); err != nil {
			log.Printf("API server error: %v", err)
		}
	}()

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
			// Разбираем payload после /start, например /start birth_spread
			text := strings.TrimSpace(update.Message.Text)
			payload := ""
			if len(text) > len("/start") {
				payload = strings.TrimSpace(text[len("/start"):])
			}

			if payload == "birth_spread" {
				log.Printf("Received /start birth_spread from chat %d", update.Message.Chat.ID)
				// Запускаем сценарий с официальной кнопкой «поделиться номером телефона».
				cabinet.StartRegistration(bot, update.Message.Chat.ID)
			} else {
				log.Printf("Received /start from chat %d payload=%q", update.Message.Chat.ID, payload)
				handleStart(bot, update.Message.Chat.ID)
			}
			continue
		}

		// если есть активная сессия «Вопрос» — передаём сообщение ИИ-коучу
		if question.HandleUserMessage(bot, update.Message.Chat.ID, update.Message.Text) {
			continue
		}
		// если пользователь в процессе регистрации — обрабатываем ответ
		if cabinet.HandleRegistrationMessage(bot, update.Message.Chat.ID, update.Message) {
			continue
		}
	}
}

func handleStart(bot *tgbotapi.BotAPI, chatID int64) {
	msg := tgbotapi.NewMessage(chatID, "Привет! Я ваш личный бот‑психолог и коуч.\n\nЯ помогаю:\n— работать с ассоциативными и метафорическими картами\n— разбираться в ваших состояниях через вопросы и подсказки\n— использовать подходы цифровой психологии для самопознания\n\nВыберите одну из кнопок ниже, чтобы продолжить.")
	keyboard := tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🤖 ИИ Психолог-Коуч", "ai_coach"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("📨 Обратная связь", "feedback"),
			tgbotapi.NewInlineKeyboardButtonData("🎁 Подарок", "gift"),
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
	feedbackURL = "https://t.me/RyslanNovikov"
	giftText    = "🎁 Ваш подарок от психолога — короткий тест, который поможет лучше понять себя. Нажмите «Цифра дня» или перейдите далее."

	giftWhyText      = "Этот тест помогает определить ваш текущий уровень и подобрать подходящие материалы. Займёт пару минут и даст персональную рекомендацию."
	aiCoachIntroText = "ИИ Психолог-Коуч — это цифровой аналитик вашего мышления.\nОн помогает увидеть скрытые смыслы через ассоциации, метафоры и персональные числовые структуры.\n\nВы можете:\n— загрузить карту и разобрать её значение\n— описать свою ситуацию и получить направляющие вопросы\n— узнать свою цифру дня\n— получить персональный числовой разбор по дате рождения"
	aiCoachWelcomeText = "Для работы с ботом выберите раздел (кнопку ниже) от ИИ Психолога. Если вы не знаете, что выбрать — опишите свою задачу и напишите прямо сейчас в чат. Наш консультант поможет с выбором."
)

func handleCallback(bot *tgbotapi.BotAPI, q *tgbotapi.CallbackQuery, miniappURL, token string) {
	chatID := q.Message.Chat.ID
	callbackID := q.ID

	// Сначала проверяем, не относится ли callback к опросу в разделе «Обучение».
	if education.HandleSurveyCallback(bot, chatID, q.Data) {
		_, _ = bot.Request(tgbotapi.NewCallback(callbackID, ""))
		return
	}

	switch q.Data {
	case "feedback":
		text := "У вас возникла проблема с товаром или есть другой вопрос? Напишите сюда — решим ваш вопрос:\n\n" + feedbackURL
		msg := tgbotapi.NewMessage(chatID, text)
		msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonURL("✉️ Написать в Telegram", feedbackURL),
			),
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("📧 garmonia-mak@yandex.ru", "feedback_email"),
			),
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("💬 Пожелания по работе бота и карт", "feedback_suggestions"),
			),
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_back"),
			),
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("🏠 Главное меню", "ai_coach_main_menu"),
			),
		)
		if _, err := bot.Send(msg); err != nil {
			log.Printf("ERROR sending feedback message: %v", err)
		}
	case "main_menu_contacts":
		text := "У вас возникла проблема с товаром или есть другой вопрос? Напишите сюда — решим ваш вопрос:\n\n" + feedbackURL
		msg := tgbotapi.NewMessage(chatID, text)
		msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonURL("✉️ Написать в Telegram", feedbackURL),
			),
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("📧 garmonia-mak@yandex.ru", "feedback_email"),
			),
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("💬 Пожелания по работе бота и карт", "feedback_suggestions"),
			),
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_main_menu"),
			),
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("🏠 Главное меню", "ai_coach_main_menu"),
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
		mainmenu.Handle(bot, chatID, miniappURL, token)
	case "main_menu_back":
		sendGiftMessage(bot, chatID, miniappURL, token)
	case "ai_coach", "ai_coach_next":
		sendAiCoachWelcome(bot, chatID, token, miniappURL)
	case "ai_coach_question":
		question.Handle(bot, chatID)
	case "ai_coach_technique":
		technique.Handle(bot, chatID)
	case "ai_coach_card_decode":
		card_decode.Handle(bot, chatID)
	case "ai_coach_card_day":
		card_day.Handle(bot, chatID)
	case "ai_coach_number_day":
		number_day.Handle(bot, chatID)
	case "ai_coach_birth_spread":
		// Запуск сценария расклада по дате рождения: официальный запрос номера телефона.
		cabinet.StartRegistration(bot, chatID)
	case "ai_coach_main_menu":
		mainmenu.Handle(bot, chatID, miniappURL, token)
	case "ai_coach_back":
		handleStart(bot, chatID)
	case "main_menu_ai":
		sendAiCoachWelcome(bot, chatID, token, miniappURL)
	case "main_menu_education":
		education.Handle(bot, chatID)
	case "main_menu_shop":
		shop.Handle(bot, chatID)
	case "main_menu_cabinet":
		cabinet.Handle(bot, chatID)
	case "cabinet_register":
		cabinet.StartRegistration(bot, chatID)
	case "cabinet_profile":
		cabinet.SendEditProfileMenu(bot, chatID)
	case "cabinet_my_reviews":
		cabinet.SendCabinetMenu(bot, chatID, "Раздел «Мои разборы» в разработке.")
	case "cabinet_matrix":
		cabinet.SendCabinetMenu(bot, chatID, "Раздел «Матрица по дате рождения» в разработке.")
	case "cabinet_number_day":
		// Из личного кабинета «Цифра дня» открывает то же мини‑приложение, что и в разделе «Подарок».
		buttonURL := miniappURL
		if strings.Contains(miniappURL, "localhost") {
			buttonURL = "https://example.com"
		}

		replyMarkup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{"text": "Цифра дня", "web_app": map[string]string{"url": buttonURL}},
				},
			},
		}
		markupJSON, _ := json.Marshal(replyMarkup)

		body := &bytes.Buffer{}
		w := multipart.NewWriter(body)
		_ = w.WriteField("chat_id", strconv.FormatInt(chatID, 10))
		_ = w.WriteField("text", "Откройте мини‑приложение «Цифра дня» по кнопке ниже.")
		_ = w.WriteField("reply_markup", string(markupJSON))
		_ = w.Close()

		req, err := http.NewRequest(http.MethodPost, "https://api.telegram.org/bot"+token+"/sendMessage", body)
		if err != nil {
			log.Printf("ERROR cabinet_number_day request: %v", err)
			break
		}
		req.Header.Set("Content-Type", "multipart/form-data; boundary="+w.Boundary())

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Printf("ERROR cabinet_number_day sendMessage: %v", err)
			break
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(resp.Body)
			log.Printf("ERROR cabinet_number_day response: %d %s", resp.StatusCode, string(b))
		}
	case "cabinet_education":
		education.Handle(bot, chatID)
	case "cabinet_edit_phone":
		cabinet.SendCabinetMenu(bot, chatID, "Изменение телефона пока в разработке. Сейчас изменить данные можно через поддержку.")
	case "cabinet_edit_fio":
		cabinet.SendCabinetMenu(bot, chatID, "Изменение ФИО пока в разработке. Сейчас изменить данные можно через поддержку.")
	case "cabinet_edit_birthdate":
		cabinet.SendCabinetMenu(bot, chatID, "Изменение даты рождения пока в разработке. Сейчас изменить данные можно через поддержку.")
	case "feedback_email":
		emailMsg := tgbotapi.NewMessage(chatID, "Вы можете написать нам на электронную почту:\n\n📧 garmonia-mak@yandex.ru")
		emailMsg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("🏠 Главное меню", "ai_coach_main_menu"),
			),
		)
		if _, err := bot.Send(emailMsg); err != nil {
			log.Printf("ERROR sending feedback email message: %v", err)
		}
	case "feedback_suggestions":
		msg := tgbotapi.NewMessage(chatID, "Поделитесь, пожалуйста, вашими пожеланиями или вопросами по работе бота и метафорических карт.\n\nПросто напишите их следующим сообщением в чат.")
		msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("🏠 Главное меню", "ai_coach_main_menu"),
			),
		)
		if _, err := bot.Send(msg); err != nil {
			log.Printf("ERROR sending feedback suggestions message: %v", err)
		}
	case "question_end":
		question.EndSession(chatID)

		// Те же кнопки, что и в разделе «ИИ Психолог-Коуч» (включая кнопку Mini App «Цифра дня»).
		buttonURL := miniappURL
		if strings.Contains(miniappURL, "localhost") {
			buttonURL = "https://example.com"
		}

		replyMarkup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{"text": "❓ Вопрос", "callback_data": "ai_coach_question"},
					{"text": "🧩 Техника", "callback_data": "ai_coach_technique"},
				},
				{
					{"text": "🃏 Расшифровка карты", "callback_data": "ai_coach_card_decode"},
				},
				{
					{"text": "🗓️ Карта дня", "callback_data": "ai_coach_card_day"},
					{"text": "🔢 Цифра дня", "web_app": map[string]string{"url": buttonURL}},
				},
				{
					{"text": "🏠 Главное меню", "callback_data": "ai_coach_main_menu"},
				},
			},
		}
		markupJSON, _ := json.Marshal(replyMarkup)

		body := &bytes.Buffer{}
		w := multipart.NewWriter(body)
		_ = w.WriteField("chat_id", strconv.FormatInt(chatID, 10))
		_ = w.WriteField("text", "Диалог с ИИ Психолог-Коуч завершён. Если захотите продолжить, снова нажмите кнопку «Вопрос» в разделе ИИ Психолог-Коуч.")
		_ = w.WriteField("reply_markup", string(markupJSON))
		_ = w.Close()

		req, err := http.NewRequest(http.MethodPost, "https://api.telegram.org/bot"+token+"/sendMessage", body)
		if err != nil {
			log.Printf("ERROR question_end request: %v", err)
			break
		}
		req.Header.Set("Content-Type", "multipart/form-data; boundary="+w.Boundary())

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Printf("ERROR question_end sendMessage: %v", err)
			break
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(resp.Body)
			log.Printf("ERROR question_end response: %d %s", resp.StatusCode, string(b))
		}
	default:
		_, _ = bot.Request(tgbotapi.NewCallback(callbackID, ""))
		return
	}

	_, _ = bot.Request(tgbotapi.NewCallback(callbackID, ""))
}

// Картинка «Подарок» — только с диска. В этом коде нет отправки по URL (заглушек нет).
const giftImageDir = "cmd/bot/images"
const giftImageName = "number_day.png"

func sendGiftMessage(bot *tgbotapi.BotAPI, chatID int64, miniappURL, token string) {
	buttonURL := miniappURL
	if strings.Contains(miniappURL, "localhost") {
		buttonURL = "https://example.com"
	}
	replyMarkup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{{"text": "🔢 Цифра дня", "web_app": map[string]string{"url": buttonURL}}},
			{{"text": "➡️ Далее", "callback_data": "gift_next"}},
		},
	}
	markupJSON, _ := json.Marshal(replyMarkup)

	giftPath := filepath.Join(giftImageDir, giftImageName)

	if giftPath != "" {
		f, err := os.Open(giftPath)
		if err != nil {
			log.Printf("ERROR gift: не удалось открыть %q: %v", giftPath, err)
		} else {
			defer f.Close()
			log.Printf("gift: ОТПРАВЛЯЮ КАРТИНКУ С ДИСКА (не заглушка): %s", giftPath)
			body := &bytes.Buffer{}
			w := multipart.NewWriter(body)
			_ = w.WriteField("chat_id", strconv.FormatInt(chatID, 10))
			part, _ := w.CreateFormFile("photo", giftImageName)
			_, _ = io.Copy(part, f)
			_ = w.WriteField("caption", giftText)
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
			if resp.StatusCode == http.StatusOK {
				return
			}
			b, _ := io.ReadAll(resp.Body)
			log.Printf("ERROR sendPhoto (gift) response: %d %s", resp.StatusCode, string(b))
			return
		}
	}

	// Файл не найден — только текст (без картинки). Заглушки по URL в коде нет.
	log.Printf("WARNING gift: файл не найден, отправляю ТОЛЬКО ТЕКСТ (без фото): %s", giftPath)
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	_ = w.WriteField("chat_id", strconv.FormatInt(chatID, 10))
	_ = w.WriteField("text", giftText)
	_ = w.WriteField("reply_markup", string(markupJSON))
	_ = w.Close()

	req, err := http.NewRequest(http.MethodPost, "https://api.telegram.org/bot"+token+"/sendMessage", body)
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
		log.Printf("ERROR sendMessage (gift) response: %d %s", resp.StatusCode, string(b))
	}
}

// Приветственное сообщение раздела ИИ Психолог-Коуч — только текст и кнопки (без картинки-заглушки).
func sendAiCoachWelcome(_ *tgbotapi.BotAPI, chatID int64, token, miniappURL string) {
	buttonURL := miniappURL
	if strings.Contains(miniappURL, "localhost") {
		buttonURL = "https://example.com"
	}
	replyMarkup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{{"text": "❓ Вопрос", "callback_data": "ai_coach_question"}, {"text": "🧩 Техника", "callback_data": "ai_coach_technique"}},
			{{"text": "🃏 Расшифровка карты", "callback_data": "ai_coach_card_decode"}},
			{{"text": "🗓️ Карта дня", "callback_data": "ai_coach_card_day"}, {"text": "🔢 Цифра дня", "web_app": map[string]string{"url": buttonURL}}},
			{{"text": "✨ Получить расклад по дате рождения", "callback_data": "ai_coach_birth_spread"}},
			{{"text": "🏠 Главное меню", "callback_data": "ai_coach_main_menu"}},
		},
	}
	markupJSON, _ := json.Marshal(replyMarkup)

	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	_ = w.WriteField("chat_id", strconv.FormatInt(chatID, 10))
	_ = w.WriteField("text", aiCoachWelcomeText)
	_ = w.WriteField("reply_markup", string(markupJSON))
	_ = w.Close()

	req, err := http.NewRequest(http.MethodPost, "https://api.telegram.org/bot"+token+"/sendMessage", body)
	if err != nil {
		log.Printf("ERROR sendAiCoachWelcome request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "multipart/form-data; boundary="+w.Boundary())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("ERROR sendAiCoachWelcome: %v", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		log.Printf("ERROR sendMessage (ai_coach welcome) response: %d %s", resp.StatusCode, string(b))
	}
}

// sendMainMenu удалён — логика вынесена в пакет handlers/mainmenu.
