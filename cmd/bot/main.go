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

// chatID -> флаг, что пользователь нажал «Пожелания по работе бота и карт»
// и его последующие сообщения нужно пересылать в служебный канал.
var feedbackSuggestionsSessions = make(map[int64]bool)

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

	if err := db.EnsureDailyNumberTable(context.Background()); err != nil {
		log.Fatalf("db ensure daily numbers table: %v", err)
	}
	log.Println("DB daily numbers table OK")

	if err := db.EnsureCardDayTables(context.Background()); err != nil {
		log.Fatalf("db ensure card day tables: %v", err)
	}
	log.Println("DB card day tables OK")

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
	mux.HandleFunc("/api/daily-number", api.DailyNumberHandler(token))
	mux.HandleFunc("/api/open-cabinet", api.CabinetOpenHandler(token))
	mux.HandleFunc("/api/admin/upload-card", api.AdminUploadCardHandler())
	mux.HandleFunc("/api/admin/cards", api.AdminListCardsHandler())
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

		chatID := update.Message.Chat.ID

		// Если пользователь находится в режиме «Пожелания по работе бота и карт»,
		// пересылаем все его сообщения в служебный канал, но при этом не ломаем
		// основную логику обработки сообщений.
		if feedbackSuggestionsSessions[chatID] {
			const feedbackChannelID int64 = -1003751435716
			fwd := tgbotapi.NewForward(feedbackChannelID, chatID, update.Message.MessageID)
			if _, err := bot.Send(fwd); err != nil {
				log.Printf("ERROR forwarding feedback suggestion message: %v", err)
			}
		}

		// Админская загрузка карт: фото с подписью /upload_card
		if len(update.Message.Photo) > 0 && card_day.IsAdminUploadCaption(update.Message.Caption) {
			adminIDStr := os.Getenv("ADMIN_TELEGRAM_ID")
			if adminIDStr != "" {
				adminID, _ := strconv.ParseInt(adminIDStr, 10, 64)
				if update.Message.From.ID == adminID {
					card_day.HandleAdminUpload(bot, chatID, token, update.Message.Photo, update.Message.Caption)
					continue
				}
			}
			log.Printf("Rejected admin upload from non-admin user %d", update.Message.From.ID)
		}

		// Если в разделе «Расшифровка карты» мы ждём фото, разрешаем только одно фото.
		if card_decode.IsWaitingPhoto(chatID) {
			if len(update.Message.Photo) == 0 {
				msg := tgbotapi.NewMessage(chatID, "Сейчас я жду только фотографию карты. Пожалуйста, отправьте её как обычное фото без текста, видео или документов.")
				msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
					tgbotapi.NewInlineKeyboardRow(
						tgbotapi.NewInlineKeyboardButtonData("Отменить", "card_decode_cancel"),
					),
				)
				if _, err := bot.Send(msg); err != nil {
					log.Printf("ERROR sending non-photo warning: %v", err)
				}
			} else {
				card_decode.HandlePhoto(bot, chatID, token, update.Message.Photo)
				card_decode.StopWaitingPhoto(chatID)
			}
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
				log.Printf("Received /start birth_spread from chat %d", chatID)
				// Запускаем сценарий с официальной кнопкой «поделиться номером телефона».
				cabinet.StartRegistration(bot, chatID)
			} else if payload == "cabinet" {
				log.Printf("Received /start cabinet from chat %d", chatID)
				cabinet.Handle(bot, chatID)
			} else {
				log.Printf("Received /start from chat %d payload=%q", chatID, payload)
				handleStart(bot, chatID)
			}
			continue
		}

		// если есть активная сессия «Вопрос» — передаём сообщение ИИ-коучу
		if question.HandleUserMessage(bot, chatID, update.Message.Text) {
			continue
		}
		// если пользователь в процессе регистрации — обрабатываем ответ
		if cabinet.HandleRegistrationMessage(bot, chatID, update.Message) {
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
	siteURL     = "https://www.garmonia-mak.ru/"
	giftText    = "🎁 Ваш подарок от психолога — маленькая практика для осознанности.\n\nНажмите «Цифра дня» и получите послание, которое может сделать ваш день более гармоничным."

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
				tgbotapi.NewInlineKeyboardButtonURL("🌐 Наш сайт", siteURL),
			),
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_back"),
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
				tgbotapi.NewInlineKeyboardButtonURL("🌐 Наш сайт", siteURL),
			),
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_main_menu"),
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
	case "technique_1":
		technique.HandleTechnique1(bot, chatID)
	case "technique_2":
		technique.HandleTechnique2(bot, chatID)
	case "technique_3":
		technique.HandleTechnique3(bot, chatID)
	case "technique_4":
		technique.HandleTechnique4(bot, chatID)
	case "technique_5":
		technique.HandleTechnique5(bot, chatID)
	case "technique_6":
		technique.HandleTechnique6(bot, chatID)
	case "technique_7":
		technique.HandleTechnique7(bot, chatID)
	case "technique_8":
		technique.HandleTechnique8(bot, chatID)
	case "technique_discuss":
		// Из текста сообщения берём название и описание техники
		title := ""
		description := ""
		if q.Message != nil {
			full := strings.TrimSpace(q.Message.Text)
			if full != "" {
				parts := strings.SplitN(full, "\n", 2)
				title = strings.TrimSpace(parts[0])
				if len(parts) > 1 {
					description = strings.TrimSpace(parts[1])
				}
			}
		}
		if title == "" {
			title = "Психологическая техника"
		}
		question.HandleWithTechnique(bot, chatID, title, description)
	case "ai_coach_card_decode":
		card_decode.Handle(bot, chatID)
	case "ai_coach_card_day":
		card_day.Handle(bot, chatID)
	case "card_day_get":
		card_day.HandleGet(bot, chatID, q.From.ID)
	case "ai_coach_number_day":
		number_day.Handle(bot, chatID)
	case "card_decode_wait_photo":
		card_decode.StartWaitingPhoto(chatID)
		msg := tgbotapi.NewMessage(chatID, "Прикрепите фотографию карты прямо в этот диалог — как обычное фото. Сейчас можно отправить только одну карту.")
		if _, err := bot.Send(msg); err != nil {
			log.Printf("ERROR sending card_decode_wait_photo message: %v", err)
		}
	case "card_decode_cancel":
		card_decode.StopWaitingPhoto(chatID)
		msg := tgbotapi.NewMessage(chatID, "Ок, расшифровку карты отменяю. Если захотите попробовать ещё раз — нажмите «Расшифровка карты» или «Отправить фото».")
		if _, err := bot.Send(msg); err != nil {
			log.Printf("ERROR sending card_decode_cancel message: %v", err)
		}
	case "ai_coach_birth_spread":
		// Запуск сценария расклада по дате рождения: официальный запрос номера телефона.
		cabinet.StartRegistration(bot, chatID)
	case "ai_coach_main_menu":
		// Выход в главное меню — перестаём пересылать сообщения пользователя как пожелания.
		delete(feedbackSuggestionsSessions, chatID)
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
	case "cabinet_my_data":
		cabinet.SendProfileSummary(bot, chatID)
	case "cabinet_profile":
		cabinet.SendEditProfileMenu(bot, chatID)
	case "cabinet_my_reviews":
		cabinet.SendCabinetMenu(bot, chatID, "Раздел «Мои разборы» в разработке.")
	case "cabinet_digital_psychologist":
		// Запускаем диалог с ИИ как с Цифровым психологом.
		question.HandleDigital(bot, chatID)
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
		// Включаем режим, при котором все последующие сообщения пользователя пересылаются в служебный канал.
		feedbackSuggestionsSessions[chatID] = true
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
					{"text": "💬 Диалог", "callback_data": "ai_coach_question"},
					{"text": "🧩 Техники", "callback_data": "ai_coach_technique"},
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

// Картинки с диска.
const giftImageDir = "cmd/bot/images"
const giftImageName = "number_day.png"
const aiCoachWelcomeImagePath = "cmd/bot/images/ai_coach_welcome.png"

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

// Приветственное сообщение раздела ИИ Психолог-Коуч — картинка + текст и кнопки.
func sendAiCoachWelcome(_ *tgbotapi.BotAPI, chatID int64, token, miniappURL string) {
	buttonURL := miniappURL
	if strings.Contains(miniappURL, "localhost") {
		buttonURL = "https://example.com"
	}
	replyMarkup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{{"text": "💬 Диалог", "callback_data": "ai_coach_question"}, {"text": "🧩 Техники", "callback_data": "ai_coach_technique"}},
			{{"text": "🃏 Расшифровка карты", "callback_data": "ai_coach_card_decode"}},
			{{"text": "🗓️ Карта дня", "callback_data": "ai_coach_card_day"}, {"text": "🔢 Цифра дня", "web_app": map[string]string{"url": buttonURL}}},
			{{"text": "✨ Получить расклад по дате рождения", "callback_data": "ai_coach_birth_spread"}},
			{{"text": "👤 Личный кабинет", "callback_data": "main_menu_cabinet"}},
			{{"text": "🏠 Главное меню", "callback_data": "ai_coach_main_menu"}},
		},
	}
	markupJSON, _ := json.Marshal(replyMarkup)

	// Пытаемся отправить картинку с подписью и кнопками.
	if aiCoachWelcomeImagePath != "" {
		f, err := os.Open(aiCoachWelcomeImagePath)
		if err != nil {
			log.Printf("ERROR sendAiCoachWelcome: open image %q: %v", aiCoachWelcomeImagePath, err)
		} else {
			defer f.Close()
			body := &bytes.Buffer{}
			w := multipart.NewWriter(body)
			_ = w.WriteField("chat_id", strconv.FormatInt(chatID, 10))
			part, _ := w.CreateFormFile("photo", filepath.Base(aiCoachWelcomeImagePath))
			_, _ = io.Copy(part, f)
			_ = w.WriteField("caption", aiCoachWelcomeText)
			_ = w.WriteField("reply_markup", string(markupJSON))
			_ = w.Close()

			req, err := http.NewRequest(http.MethodPost, "https://api.telegram.org/bot"+token+"/sendPhoto", body)
			if err != nil {
				log.Printf("ERROR sendAiCoachWelcome sendPhoto request: %v", err)
				return
			}
			req.Header.Set("Content-Type", "multipart/form-data; boundary="+w.Boundary())

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				log.Printf("ERROR sendAiCoachWelcome sendPhoto: %v", err)
				return
			}
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return
			}
			b, _ := io.ReadAll(resp.Body)
			log.Printf("ERROR sendAiCoachWelcome sendPhoto response: %d %s", resp.StatusCode, string(b))
			// При ошибке ниже отправим текстовый вариант.
		}
	}

	// Фоллбэк: если не удалось отправить картинку, шлём только текст с кнопками.
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	_ = w.WriteField("chat_id", strconv.FormatInt(chatID, 10))
	_ = w.WriteField("text", aiCoachWelcomeText)
	_ = w.WriteField("reply_markup", string(markupJSON))
	_ = w.Close()

	req, err := http.NewRequest(http.MethodPost, "https://api.telegram.org/bot"+token+"/sendMessage", body)
	if err != nil {
		log.Printf("ERROR sendAiCoachWelcome fallback request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "multipart/form-data; boundary="+w.Boundary())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("ERROR sendAiCoachWelcome fallback: %v", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		log.Printf("ERROR sendMessage (ai_coach welcome fallback) response: %d %s", resp.StatusCode, string(b))
	}
}

// sendMainMenu удалён — логика вынесена в пакет handlers/mainmenu.
