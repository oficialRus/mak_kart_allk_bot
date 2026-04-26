package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode"

	"mak_kart_allk_bot/internal/api"
	"mak_kart_allk_bot/internal/db"
	"mak_kart_allk_bot/internal/repository"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"github.com/joho/godotenv"
)

// isCardDayUploader — кому разрешена загрузка карт дня через /upload_card (личные Telegram user id).
func isCardDayUploader(userID int64) bool {
	switch userID {
	case 7217012505, 7571408504:
		return true
	default:
		return false
	}
}

func main() {
	// Пробуем загрузить .env из разных рабочих директорий (в т.ч. после split на backend/frontend).
	for _, path := range []string{".env", "../.env", "../../.env"} {
		if err := godotenv.Load(path); err == nil {
			log.Printf("Loaded env from %s", path)
			break
		}
	}
	if err := api.RequireEmailOTPSecret(); err != nil {
		log.Fatalf("email otp secret: %v", err)
	}

	// Инициализируем подключение к PostgreSQL и таблицы, которые использует mini_app.
	if err := db.InitFromEnv(); err != nil {
		log.Fatalf("db init: %v", err)
	}
	log.Println("DB connected OK")

	if err := db.EnsureProfileTable(context.Background()); err != nil {
		log.Fatalf("db ensure profile table: %v", err)
	}
	if err := db.EnsureEmailVerificationTables(context.Background()); err != nil {
		log.Fatalf("db ensure email verification tables: %v", err)
	}
	if err := db.EnsureCabinetAuthSessionsTable(context.Background()); err != nil {
		log.Fatalf("db ensure cabinet auth sessions: %v", err)
	}
	if err := db.EnsureDailyNumberTable(context.Background()); err != nil {
		log.Fatalf("db ensure daily numbers table: %v", err)
	}
	if err := db.EnsureDailyAffirmationTable(context.Background()); err != nil {
		log.Fatalf("db ensure daily affirmations table: %v", err)
	}
	if err := db.EnsureDialogsTable(context.Background()); err != nil {
		log.Fatalf("db ensure dialogs table: %v", err)
	}
	if err := db.EnsureCardDayTables(context.Background()); err != nil {
		log.Fatalf("db ensure card day tables: %v", err)
	}
	if err := db.EnsureUsersTable(context.Background()); err != nil {
		log.Fatalf("db ensure users table: %v", err)
	}
	if err := db.BackfillUsersFromLegacy(context.Background()); err != nil {
		log.Fatalf("db users backfill: %v", err)
	}

	token := strings.TrimSpace(os.Getenv("BOT_TOKEN"))
	mode := strings.ToLower(strings.TrimSpace(os.Getenv("AUTH_MODE")))
	botEnabled := token != "" && mode != "email_only"
	if !botEnabled {
		if mode == "email_only" {
			log.Println("AUTH_MODE=email_only — bot polling disabled")
		} else {
			log.Println("BOT_TOKEN empty — bot polling disabled")
		}
	}

	miniappURL := resolveMiniAppURL(os.Getenv("MINI_APP_URL"))

	// HTTP API для мини‑приложения — как было раньше.
	apiPort := strings.TrimSpace(os.Getenv("API_PORT"))
	if apiPort == "" {
		apiPort = "8080"
	}
	emailVerifySvc := api.NewEmailVerifyService()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/profile", api.ProfileHandler(token))
	mux.HandleFunc("/api/profile-get", api.ProfileGetHandler(token))
	mux.HandleFunc("/api/auth/email/send-code", api.EmailSendCodeHandler(token, emailVerifySvc))
	mux.HandleFunc("/api/auth/email/verify-code", api.EmailVerifyCodeHandler(token, emailVerifySvc))
	mux.HandleFunc("/api/auth/telegram", api.AuthTelegramHandler(token))
	mux.Handle("/api/auth/me", api.AuthMeHandler(token))
	mux.HandleFunc("/api/auth/cabinet/validate-session", api.CabinetValidateSessionHandler())
	mux.HandleFunc("/api/auth/cabinet/logout", api.CabinetLogoutHandler())
	mux.HandleFunc("/api/daily-number", api.DailyNumberHandler(token))
	mux.HandleFunc("/api/open-cabinet", api.CabinetOpenHandler(token))
	mux.HandleFunc("/api/open-main-menu", api.MainMenuOpenHandler(token))
	mux.HandleFunc("/api/ai-dialog", api.AiDialogHandler(token))
	mux.HandleFunc("/api/daily-affirmation", api.DailyAffirmationHandler(token))
	mux.HandleFunc("/api/card-day", api.CardDayHandler(token))
	mux.HandleFunc("/api/dialog-save", api.DialogSaveHandler(token))
	mux.HandleFunc("/api/dialogs", api.DialogsListHandler(token))
	mux.HandleFunc("/api/dialog", api.DialogGetHandler(token))
	mux.HandleFunc("/api/admin/upload-card", api.AdminUploadCardHandler())
	mux.HandleFunc("/api/admin/cards", api.AdminListCardsHandler())
	// Статические изображения карт дня для мини‑приложения — через отдельный обработчик.
	mux.HandleFunc("/api/card-image", api.CardImageHandler())

	go func() {
		log.Printf("Mini app API listening on :%s", apiPort)
		if err := http.ListenAndServe(":"+apiPort, api.WithCORS(mux)); err != nil {
			log.Printf("API server error: %v", err)
		}
	}()

	if botEnabled {
		log.Println("Connecting to Telegram...")
		bot, err := tgbotapi.NewBotAPI(token)
		if err != nil {
			log.Fatalf("bot init: %v", err)
		}
		log.Printf("Bot started: @%s", bot.Self.UserName)

		// Снимаем webhook, чтобы получать апдейты через getUpdates.
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
			// Обработка нажатий на inline‑кнопки.
			if update.CallbackQuery != nil {
				handleCallback(bot, update.CallbackQuery, miniappURL)
				continue
			}

			if update.Message == nil {
				continue
			}

			chatID := update.Message.Chat.ID

			// Разрешённые аккаунты могут загружать новые карты дня: фото + подпись /upload_card
			if update.Message.From != nil &&
				isCardDayUploader(update.Message.From.ID) &&
				len(update.Message.Photo) > 0 &&
				strings.HasPrefix(strings.TrimSpace(update.Message.Caption), "/upload_card") {
				go handleAdminUpload(bot, token, update.Message.Photo, chatID)
				continue
			}
			// Любая slash-команда (/start, /help и т.д.) возвращает единое приветствие.
			if update.Message.IsCommand() {
				handleStart(bot, chatID, miniappURL)
			}
		}
	}

	select {}
}

func handleStart(bot *tgbotapi.BotAPI, chatID int64, miniappURL string) {
	buttonURL := strings.TrimSpace(miniappURL)
	if buttonURL == "" {
		buttonURL = "https://app.garmonia-mak.ru/"
	}
	text := "Это – ваш ии психолог-коуч по работе с метафорическими ассоциативными картами.\n\nНаш уникальный инструмент помогает Вам в работе с самопознанием через ассоциации, метафоры, аффирмации и цифры.\n\nОткройте приложение и начните работу с своим подсознанием."

	keyboard := tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("📨 Обратная связь", "feedback_menu"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonWebApp("📱 Открыть приложение", tgbotapi.WebAppInfo{URL: buttonURL}),
		),
	)

	// Пытаемся отправить картинку с подписью + кнопками.
	// Файл должен лежать по пути startImagePath относительно рабочей директории бота.
	photoConfig := tgbotapi.NewPhoto(chatID, tgbotapi.FilePath(startImagePath))
	photoConfig.Caption = text
	photoConfig.ReplyMarkup = keyboard

	if _, err := bot.Send(photoConfig); err != nil {
		log.Printf("ERROR sending /start photo, fallback to text: %v", err)

		// Если не получилось отправить фото (например, файла нет) — отправляем просто текст.
		msg := tgbotapi.NewMessage(chatID, text)
		msg.ReplyMarkup = keyboard
		if _, err := bot.Send(msg); err != nil {
			log.Printf("ERROR sending /start message: %v", err)
			return
		}
	}

	log.Printf("Sent /start welcome (photo or text) with feedback + mini app buttons to chat %d", chatID)
}

func resolveMiniAppURL(raw string) string {
	const defaultURL = "https://app.garmonia-mak.ru/"

	clean := strings.TrimSpace(raw)
	if clean == "" {
		return defaultURL
	}

	// Частая ошибка в .env: случайные пробелы внутри URL (например, "https://app. ... ru/").
	clean = strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			return -1
		}
		return r
	}, clean)

	parsed, err := url.ParseRequestURI(clean)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "https" && parsed.Scheme != "http") {
		log.Printf("WARNING invalid MINI_APP_URL=%q, fallback to %s", raw, defaultURL)
		return defaultURL
	}
	return clean
}

const (
	// Локальный путь до картинки, которая показывается в приветственном сообщении /start.
	// Положите сюда нужное изображение (например, картинку карты).
	startImagePath = "data/cards/start_welcome.jpg.webp.webp"

	feedbackURL = "https://t.me/RyslanNovikov"
	siteURL     = "https://www.garmonia-mak.ru/"
)

// Восстанавливаем простое меню «Обратная связь», похожее на прежнее.
func handleCallback(bot *tgbotapi.BotAPI, q *tgbotapi.CallbackQuery, miniappURL string) {
	chatID := q.Message.Chat.ID
	data := q.Data

	switch data {
	case "feedback_menu":
		text := "У вас возникла проблема с товаром или есть другой вопрос? Напишите — поможем.\n\nВыберите удобный способ связи:"
		msg := tgbotapi.NewMessage(chatID, text)
		msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonURL("✉️ Написать в Telegram", feedbackURL),
			),
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("📧 garmonia-mak@yandex.ru", "feedback_email"),
			),
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonURL("🌐 Наш сайт", siteURL),
			),
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "feedback_back"),
			),
		)
		if _, err := bot.Send(msg); err != nil {
			log.Printf("ERROR sending feedback menu: %v", err)
		}
	case "feedback_email":
		emailMsg := tgbotapi.NewMessage(chatID, "Вы можете написать нам на электронную почту:\n\n📧 garmonia-mak@yandex.ru")
		if _, err := bot.Send(emailMsg); err != nil {
			log.Printf("ERROR sending feedback email message: %v", err)
		}
	case "feedback_back":
		// Возвращаемся к исходному сообщению /start.
		handleStart(bot, chatID, miniappURL)
	default:
		// На всякий случай просто подтверждаем callback без ответа.
	}

	// Всегда подтверждаем callback, чтобы убрать «часики» в Telegram.
	_, _ = bot.Request(tgbotapi.NewCallback(q.ID, ""))
}

// handleAdminUpload сохраняет присланную админом фотографию карты в папку data/cards.
func handleAdminUpload(bot *tgbotapi.BotAPI, token string, photos []tgbotapi.PhotoSize, chatID int64) {
	if len(photos) == 0 {
		return
	}

	// Берём самое большое фото (последний элемент).
	photo := photos[len(photos)-1]

	file, err := bot.GetFile(tgbotapi.FileConfig{FileID: photo.FileID})
	if err != nil {
		log.Printf("admin upload: GetFile error: %v", err)
		_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Не удалось получить файл от Telegram. Попробуйте ещё раз."))
		return
	}

	url := fmt.Sprintf("https://api.telegram.org/file/bot%s/%s", token, file.FilePath)
	resp, err := http.Get(url)
	if err != nil {
		log.Printf("admin upload: http.Get error: %v", err)
		_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Не удалось скачать файл с серверов Telegram."))
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("admin upload: bad status %d: %s", resp.StatusCode, string(body))
		_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Telegram вернул ошибку при скачивании файла."))
		return
	}

	if err := os.MkdirAll("data/cards", 0o755); err != nil {
		log.Printf("admin upload: MkdirAll error: %v", err)
		_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Не удалось подготовить папку для сохранения картинок."))
		return
	}

	ext := filepath.Ext(file.FilePath)
	if ext == "" {
		ext = ".jpg"
	}
	filename := fmt.Sprintf("card_%d_%s%s", time.Now().Unix(), photo.FileID, ext)
	fullPath := filepath.Join("data", "cards", filename)

	out, err := os.Create(fullPath)
	if err != nil {
		log.Printf("admin upload: create file error: %v", err)
		_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Не удалось сохранить файл на сервере."))
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, resp.Body); err != nil {
		log.Printf("admin upload: copy error: %v", err)
		_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Ошибка при сохранении файла на сервере."))
		return
	}

	// Регистрируем карту в БД, чтобы она участвовала в выборе «Карты дня».
	if _, err := repository.CreateCardDayCard(context.Background(), filename, "", ""); err != nil {
		log.Printf("admin upload: CreateCardDayCard error: %v", err)
		_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Файл сохранён, но не удалось зарегистрировать карту в базе."))
		return
	}

	log.Printf("admin upload: saved card image to %s and created DB record", fullPath)
	_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Карта успешно загружена и добавлена в мини‑приложение."))
}

