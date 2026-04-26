package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"mak_kart_allk_bot/internal/auth"
	"mak_kart_allk_bot/internal/emailverify"
	"mak_kart_allk_bot/internal/db"
	"mak_kart_allk_bot/internal/mailer"
	"mak_kart_allk_bot/internal/repository"
	"mak_kart_allk_bot/internal/webapp"
)

type emailSendCodeRequest struct {
	InitData          string `json:"initData"`
	CabinetDeviceID   string `json:"cabinetDeviceId"`
	Email             string `json:"email"`
}

type emailVerifyCodeRequest struct {
	InitData          string `json:"initData"`
	CabinetDeviceID   string `json:"cabinetDeviceId"`
	Email             string `json:"email"`
	Code              string `json:"code"`
}

// effectiveEmailOTPSecret использует ТОЛЬКО EMAIL_OTP_SECRET.
// Fallback от BOT_TOKEN намеренно удалён (этап 6.3).
func effectiveEmailOTPSecret() string {
	return strings.TrimSpace(os.Getenv("EMAIL_OTP_SECRET"))
}

// RequireEmailOTPSecret — жёсткая проверка обязательного секрета OTP на старте.
func RequireEmailOTPSecret() error {
	if effectiveEmailOTPSecret() == "" {
		return fmt.Errorf("EMAIL_OTP_SECRET is required")
	}
	return nil
}

// cabinetSessionPepper — отдельный секрет для хэша session token или тот же базовый секрет, что и OTP.
func cabinetSessionPepper() string {
	if s := strings.TrimSpace(os.Getenv("CABINET_SESSION_SECRET")); s != "" {
		return s
	}
	return effectiveEmailOTPSecret()
}

// cabinetSessionTTL по умолчанию 30 суток; CABINET_SESSION_DAYS — целое число дней.
func cabinetSessionTTL() time.Duration {
	v := strings.TrimSpace(os.Getenv("CABINET_SESSION_DAYS"))
	if v != "" {
		if d, err := strconv.Atoi(v); err == nil && d > 0 {
			return time.Duration(d) * 24 * time.Hour
		}
	}
	return 30 * 24 * time.Hour
}

func issueCabinetSessionJSON(ctx context.Context, w http.ResponseWriter, userID int64, emailRaw string, extra map[string]interface{}) {
	emailNorm := emailverify.NormalizeEmail(emailRaw)
	pepper := cabinetSessionPepper()
	ttl := cabinetSessionTTL()
	tok, exp, err := repository.CreateCabinetSession(ctx, userID, emailNorm, pepper, ttl)
	if err != nil {
		log.Printf("api cabinet session: create user_id=%d err=%v", userID, err)
		writeEmailJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		return
	}
	out := map[string]interface{}{
		"ok":               true,
		"sessionToken":     tok,
		"sessionExpiresAt": exp.UTC().Format(time.RFC3339),
	}
	if cookieAuthEnabled() {
		setCabinetAuthCookies(w, tok, exp.UTC())
	}
	for k, v := range extra {
		out[k] = v
	}
	writeEmailJSON(w, http.StatusOK, out)
}

func lookupTelegramIDForUser(ctx context.Context, userID int64) (*int64, error) {
	var tg sql.NullInt64
	err := db.Pool.QueryRowContext(ctx, `SELECT telegram_id FROM users WHERE id = $1 LIMIT 1;`, userID).Scan(&tg)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	if err == nil && tg.Valid && tg.Int64 > 0 {
		v := tg.Int64
		return &v, nil
	}

	// Legacy fallback до полного завершения миграции users.
	var legacy int64
	err = db.Pool.QueryRowContext(ctx, `
		SELECT telegram_id
		FROM mini_app_profiles
		WHERE telegram_id = $1 AND telegram_id > 0
		LIMIT 1;
	`, userID).Scan(&legacy)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &legacy, nil
}

// NewEmailVerifyService собирает сервис из переменных окружения (SMTP опционально).
func NewEmailVerifyService() *emailverify.Service {
	secret := effectiveEmailOTPSecret()
	devLog := strings.TrimSpace(os.Getenv("EMAIL_OTP_DEV_LOG")) == "1" || strings.EqualFold(strings.TrimSpace(os.Getenv("EMAIL_OTP_DEV_LOG")), "true")

	host := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	portStr := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	user := strings.TrimSpace(os.Getenv("SMTP_USER"))
	pass := strings.TrimSpace(os.Getenv("SMTP_PASSWORD"))
	from := strings.TrimSpace(os.Getenv("SMTP_FROM"))
	useTLS := strings.TrimSpace(os.Getenv("SMTP_USE_TLS")) != "0" // по умолчанию STARTTLS

	resendKey := strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	resendFrom := strings.TrimSpace(os.Getenv("RESEND_FROM"))
	if resendFrom == "" {
		resendFrom = from
	}

	var ms mailer.Sender
	if resendKey != "" && resendFrom != "" {
		rs, err := mailer.NewResend(resendKey, resendFrom)
		if err != nil {
			log.Printf("WARNING: Resend init failed: %v", err)
		} else {
			ms = rs
			log.Printf("mail: using Resend API (from=%s)", resendFrom)
		}
	}
	if ms == nil && host != "" && from != "" {
		port := 587
		if portStr != "" {
			if p, err := strconv.Atoi(portStr); err == nil && p > 0 {
				port = p
			}
		}
		implicitTLS := port == 465 || strings.TrimSpace(os.Getenv("SMTP_IMPLICIT_TLS")) == "1"
		useStartTLS := useTLS && !implicitTLS
		s, err := mailer.NewSmtp(mailer.SmtpConfig{
			Host:        host,
			Port:        port,
			User:        user,
			Password:    pass,
			From:        from,
			UseTLS:      useStartTLS,
			ImplicitTLS: implicitTLS,
		})
		if err != nil {
			log.Printf("WARNING: SMTP init failed (email codes disabled until fixed): %v", err)
		} else {
			ms = s
			log.Printf("mail: using SMTP %s:%d", host, port)
		}
	}

	strictSMTP := strings.TrimSpace(os.Getenv("EMAIL_OTP_STRICT_SMTP")) == "1"
	botTok := strings.TrimSpace(os.Getenv("BOT_TOKEN"))
	alsoTG := strings.TrimSpace(os.Getenv("EMAIL_OTP_ALSO_TELEGRAM")) == "1" ||
		strings.EqualFold(strings.TrimSpace(os.Getenv("EMAIL_OTP_ALSO_TELEGRAM")), "true")
	tgFallback := strings.TrimSpace(os.Getenv("EMAIL_OTP_TELEGRAM_FALLBACK")) == "1" ||
		strings.EqualFold(strings.TrimSpace(os.Getenv("EMAIL_OTP_TELEGRAM_FALLBACK")), "true")
	tgDisabled := strings.TrimSpace(os.Getenv("EMAIL_OTP_DISABLE_TELEGRAM")) == "1" ||
		strings.EqualFold(strings.TrimSpace(os.Getenv("EMAIL_OTP_DISABLE_TELEGRAM")), "true")

	return &emailverify.Service{
		Secret:             secret,
		MailSender:         ms,
		BotToken:           botTok,
		DevLogCode:         devLog,
		StrictSMTP:         strictSMTP,
		AlsoTelegramOTP:    alsoTG,
		TelegramFallback:   tgFallback,
		TelegramDisabled:   tgDisabled,
	}
}

// EmailSendCodeHandler POST /api/auth/email/send-code
func EmailSendCodeHandler(botToken string, svc *emailverify.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req emailSendCodeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeEmailJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request"})
			return
		}
		mode := currentAuthMode()
		if mode == authModeEmailOnly {
			req.InitData = ""
		}
		if mode == authModeTelegramOnly {
			req.CabinetDeviceID = ""
		}

		userID, err := webapp.ResolveCabinetUserID(botToken, req.InitData, req.CabinetDeviceID)
		if err != nil {
			if strings.TrimSpace(req.InitData) != "" {
				log.Printf("api email send-code: initData invalid: %v", err)
				writeEmailJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
				return
			}
			writeEmailJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request"})
			return
		}

		sessionUserID := userID
		telegramID, err := lookupTelegramIDForUser(r.Context(), sessionUserID)
		if err != nil {
			log.Printf("api email send-code: lookup telegram_id failed user_id=%d: %v", sessionUserID, err)
			writeEmailJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}
		res, err := svc.SendCode(r.Context(), sessionUserID, telegramID, req.Email)
		// Почта могла быть подтверждена на legacy telegram_id, а сейчас приоритет у cabinetDeviceId — повтор с initData.
		if errors.Is(err, emailverify.ErrInvalidEmail) && strings.TrimSpace(req.InitData) != "" {
			if tgID, errTG := webapp.ValidateInitData(botToken, req.InitData); errTG == nil && tgID != sessionUserID {
				tgCopy := tgID
				res2, err2 := svc.SendCode(r.Context(), tgID, &tgCopy, req.Email)
				if err2 == nil || !errors.Is(err2, emailverify.ErrInvalidEmail) {
					res, err = res2, err2
					if err == nil {
						sessionUserID = tgID
						log.Printf("api email send-code: ok via telegram_id=%d (cabinet user_id was %d)", tgID, userID)
					}
				}
			}
		}
		// Почта уже подтверждена на другом user_id (новое устройство/браузер):
		// отправляем OTP владельцу email, чтобы пользователь мог войти в свой существующий аккаунт.
		if errors.Is(err, emailverify.ErrInvalidEmail) {
			if ownerID, errOwner := auth.ResolveByEmail(r.Context(), req.Email); errOwner == nil && ownerID > 0 && ownerID != sessionUserID {
				ownerTelegramID, errTg := lookupTelegramIDForUser(r.Context(), ownerID)
				if errTg != nil {
					log.Printf("api email send-code: owner telegram lookup failed owner_id=%d: %v", ownerID, errTg)
				} else {
					res2, err2 := svc.SendCode(r.Context(), ownerID, ownerTelegramID, req.Email)
					if err2 == nil {
						res = res2
						err = nil
						sessionUserID = ownerID
						log.Printf("api email send-code: ok via verified email owner_id=%d (request user_id was %d)", ownerID, userID)
					} else {
						err = err2
					}
				}
			}
		}
		if errors.Is(err, emailverify.ErrMissingSecret) {
			log.Printf("api email send-code: EMAIL_OTP_SECRET not set")
			writeEmailJSON(w, http.StatusInternalServerError, map[string]string{"error": "service_unavailable"})
			return
		}
		if errors.Is(err, emailverify.ErrInvalidEmail) {
			writeEmailJSON(w, http.StatusBadRequest, map[string]string{"error": "email_blocked"})
			return
		}
		if errors.Is(err, emailverify.ErrRateLimited) {
			retry := 60
			if res != nil && res.RetryAfterSecs > 0 {
				retry = res.RetryAfterSecs
			}
			writeEmailJSON(w, http.StatusTooManyRequests, map[string]interface{}{
				"error":             "rate_limited",
				"retryAfterSeconds": retry,
			})
			return
		}
		if errors.Is(err, emailverify.ErrSendFailed) {
			writeEmailJSON(w, http.StatusBadGateway, map[string]string{"error": "send_failed"})
			return
		}
		if err != nil {
			log.Printf("api email send-code: user_id=%d err=%v", sessionUserID, err)
			writeEmailJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		delivery := emailverify.DeliverySMTP
		if res != nil && res.Delivery != "" {
			delivery = res.Delivery
		}
		writeEmailJSON(w, http.StatusOK, map[string]interface{}{
			"ok":        true,
			"delivery":  delivery,
		})
	}
}

// EmailVerifyCodeHandler POST /api/auth/email/verify-code
func EmailVerifyCodeHandler(botToken string, svc *emailverify.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req emailVerifyCodeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeEmailJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request"})
			return
		}
		mode := currentAuthMode()
		if mode == authModeEmailOnly {
			req.InitData = ""
		}
		if mode == authModeTelegramOnly {
			req.CabinetDeviceID = ""
		}

		userID, err := webapp.ResolveCabinetUserID(botToken, req.InitData, req.CabinetDeviceID)
		if err != nil {
			if strings.TrimSpace(req.InitData) != "" {
				log.Printf("api email verify-code: initData invalid: %v", err)
				writeEmailJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
				return
			}
			writeEmailJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request"})
			return
		}

		sessionUserID := userID
		err = svc.VerifyCode(r.Context(), sessionUserID, req.Email, req.Code)
		if errors.Is(err, repository.ErrVerificationFailed) && strings.TrimSpace(req.InitData) != "" {
			if tgID, errTG := webapp.ValidateInitData(botToken, req.InitData); errTG == nil && tgID != sessionUserID {
				if err2 := svc.VerifyCode(r.Context(), tgID, req.Email, req.Code); err2 == nil {
					sessionUserID = tgID
					err = nil
					log.Printf("api email verify-code: ok via telegram_id=%d (cabinet user_id was %d)", tgID, userID)
				}
			}
		}
		// Код мог быть выписан на владельца email (existing account), а текущий user_id пришёл от нового устройства.
		if errors.Is(err, repository.ErrVerificationFailed) {
			if ownerID, errOwner := auth.ResolveByEmail(r.Context(), req.Email); errOwner == nil && ownerID > 0 && ownerID != sessionUserID {
				if err2 := svc.VerifyCode(r.Context(), ownerID, req.Email, req.Code); err2 == nil {
					sessionUserID = ownerID
					err = nil
					log.Printf("api email verify-code: ok via verified email owner_id=%d (request user_id was %d)", ownerID, userID)
				}
			}
		}
		if errors.Is(err, emailverify.ErrMissingSecret) {
			writeEmailJSON(w, http.StatusInternalServerError, map[string]string{"error": "service_unavailable"})
			return
		}
		if errors.Is(err, emailverify.ErrInvalidEmail) {
			writeEmailJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request"})
			return
		}
		if errors.Is(err, repository.ErrVerificationFailed) {
			log.Printf("api email verify-code: failed user_id=%d (wrong, expired, or locked)", sessionUserID)
			writeEmailJSON(w, http.StatusBadRequest, map[string]string{"error": "verification_failed"})
			return
		}
		if err != nil {
			log.Printf("api email verify-code: user_id=%d err=%v", sessionUserID, err)
			writeEmailJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		log.Printf("api email verify-code: ok user_id=%d", sessionUserID)
		issueCabinetSessionJSON(r.Context(), w, sessionUserID, req.Email, nil)
	}
}

type cabinetSessionTokenRequest struct {
	SessionToken string `json:"sessionToken"`
}

// CabinetValidateSessionHandler POST /api/auth/cabinet/validate-session — проверка opaque-токена сессии кабинета.
func CabinetValidateSessionHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req cabinetSessionTokenRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
			writeEmailJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request"})
			return
		}
		tok := strings.TrimSpace(req.SessionToken)
		if tok == "" && cookieAuthEnabled() {
			if c, err := r.Cookie(cabinetSessionCookieName); err == nil {
				tok = strings.TrimSpace(c.Value)
			}
		}
		if tok == "" {
			writeEmailJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid_session"})
			return
		}
		_, ok, err := repository.ValidateCabinetSessionToken(r.Context(), tok, cabinetSessionPepper())
		if err != nil {
			log.Printf("api cabinet validate-session: %v", err)
			writeEmailJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}
		if !ok {
			writeEmailJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid_session"})
			return
		}
		writeEmailJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

// CabinetLogoutHandler POST /api/auth/cabinet/logout — отзыв сессии по токену.
func CabinetLogoutHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req cabinetSessionTokenRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
			writeEmailJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request"})
			return
		}
		tok := strings.TrimSpace(req.SessionToken)
		if tok == "" && cookieAuthEnabled() {
			if c, err := r.Cookie(cabinetSessionCookieName); err == nil {
				tok = strings.TrimSpace(c.Value)
			}
		}
		if err := repository.RevokeCabinetSessionByToken(r.Context(), tok, cabinetSessionPepper()); err != nil {
			log.Printf("api cabinet logout: %v", err)
			writeEmailJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}
		clearCabinetAuthCookies(w)
		writeEmailJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

func writeEmailJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
