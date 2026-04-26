package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"

	"mak_kart_allk_bot/internal/api"
	"mak_kart_allk_bot/internal/db"

	"github.com/joho/godotenv"
)

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

	// Инициализируем подключение к PostgreSQL.
	if err := db.InitFromEnv(); err != nil {
		log.Fatalf("db init: %v", err)
	}
	log.Println("DB connected OK")

	// Гарантируем наличие всех таблиц, которые использует mini_app.
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
	if token == "" {
		log.Println("BOT_TOKEN empty — Telegram initData auth endpoints will be unavailable")
	}

	// HTTP API для мини‑приложения (сохранение профиля: ФИО, дата рождения, Telegram ID и т.д.).
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
	// Статические изображения карт дня для мини‑приложения.
	mux.Handle("/cards/", http.StripPrefix("/cards/", http.FileServer(http.Dir("data/cards"))))

	log.Printf("Mini app API listening on :%s", apiPort)
	if err := http.ListenAndServe(":"+apiPort, api.WithCORS(mux)); err != nil {
		log.Fatalf("API server error: %v", err)
	}
}

