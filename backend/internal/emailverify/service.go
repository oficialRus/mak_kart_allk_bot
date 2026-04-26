package emailverify

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"

	"mak_kart_allk_bot/internal/mailer"
	"mak_kart_allk_bot/internal/repository"
	"mak_kart_allk_bot/internal/telegramapi"
)

const (
	CodeTTL            = 10 * time.Minute
	ResendCooldown     = 60 * time.Second
	MaxSendsPerHour    = 5
	DefaultMaxAttempts = 5
)

var (
	ErrInvalidEmail  = errors.New("invalid email")
	ErrRateLimited   = errors.New("rate limited")
	ErrAlreadyBound  = errors.New("email already verified for this account")
	ErrSendFailed    = errors.New("failed to send email")
	ErrMissingSecret = errors.New("otp secret not configured")
)

type Service struct {
	Secret     string
	MailSender mailer.Sender
	// BotToken: для отправки кода в Telegram пользователю (mini app, реальный telegram_id > 0).
	BotToken string
	// DevLogCode: явно включить запись кода в лог (удобно вместе с SMTP).
	DevLogCode bool
	// StrictSMTP: если true — нельзя обойтись только логом; нужен успешный SMTP/Resend и/или Telegram.
	StrictSMTP bool
	// AlsoTelegramOTP: при успешной доставке на почту (SMTP/Resend) дублировать код в Telegram.
	AlsoTelegramOTP bool
	// TelegramFallback: если почта (SMTP/Resend) не удалась — отправить код в Telegram.
	TelegramFallback bool
	// TelegramDisabled: EMAIL_OTP_DISABLE_TELEGRAM — никогда не слать код в Telegram.
	TelegramDisabled bool
}

const (
	DeliverySMTP         = "smtp"
	DeliveryTelegram     = "telegram"
	DeliveryTelegramSMTP = "telegram_smtp"
	DeliveryLogOnly      = "log_only"
)

type SendCodeResult struct {
	RetryAfterSecs int
	Delivery       string // DeliverySMTP | DeliveryLogOnly
}

func (s *Service) SendCode(ctx context.Context, userID int64, telegramID *int64, emailRaw string) (*SendCodeResult, error) {
	if s.Secret == "" {
		return nil, ErrMissingSecret
	}
	emailRaw = NormalizeEmail(emailRaw)
	if !ValidateEmailFormat(emailRaw) {
		return nil, ErrInvalidEmail
	}

	now := time.Now().UTC()
	since := now.Add(-time.Hour)

	nTG, err := repository.CountSendsTelegramSince(ctx, userID, since)
	if err != nil {
		return nil, err
	}
	nEm, err := repository.CountSendsEmailSince(ctx, emailRaw, since)
	if err != nil {
		return nil, err
	}
	if nTG >= MaxSendsPerHour || nEm >= MaxSendsPerHour {
		return &SendCodeResult{RetryAfterSecs: 3600}, ErrRateLimited
	}

	lastTG, err := repository.LastSendTimeForTelegram(ctx, userID)
	if err != nil {
		return nil, err
	}
	lastEm, err := repository.LastSendTimeForEmail(ctx, emailRaw)
	if err != nil {
		return nil, err
	}
	if lastTG != nil {
		if d := ResendCooldown - now.Sub(*lastTG); d > 0 {
			return &SendCodeResult{RetryAfterSecs: int(d.Seconds()) + 1}, ErrRateLimited
		}
	}
	if lastEm != nil {
		if d := ResendCooldown - now.Sub(*lastEm); d > 0 {
			return &SendCodeResult{RetryAfterSecs: int(d.Seconds()) + 1}, ErrRateLimited
		}
	}

	owner, taken, err := repository.VerifiedEmailOwner(ctx, emailRaw, userID)
	if err != nil {
		return nil, err
	}
	if taken && owner != 0 {
		// Не раскрываем, что email занят — для клиента как rate limit / общая ошибка.
		log.Printf("emailverify: send blocked, email already verified by another user user_id=%d", userID)
		return nil, ErrInvalidEmail
	}

	expires := now.Add(CodeTTL)

	if err := repository.InvalidatePendingForTelegram(ctx, userID); err != nil {
		return nil, err
	}

	code, err := randomDigits(6)
	if err != nil {
		return nil, err
	}
	hash := HashOTP(s.Secret, emailRaw, userID, code)
	if _, err := repository.InsertEmailVerification(ctx, userID, emailRaw, emailRaw, hash, expires, DefaultMaxAttempts, now); err != nil {
		return nil, err
	}

	emailMsg := mailer.OTPVerificationEmail(code)

	smtpOK := false
	if s.MailSender != nil {
		if err := s.MailSender.Send(ctx, []string{emailRaw}, emailMsg); err != nil {
			log.Printf("emailverify: smtp send failed user_id=%d: %v", userID, err)
		} else {
			smtpOK = true
		}
	}

	emailOK := smtpOK
	tgOK := false
	canUseTelegram := telegramID != nil && *telegramID > 0
	if !s.TelegramDisabled && canUseTelegram && strings.TrimSpace(s.BotToken) != "" {
		sendTG := (s.AlsoTelegramOTP && emailOK) || (s.TelegramFallback && !emailOK)
		if sendTG {
			tgText := fmt.Sprintf(
				"🔐 Код для входа в личный кабинет ГАРМОНИЯ‑МАК: %s\n\nДействует 10 минут. Никому не сообщайте код.\n\nЕсли вы не запрашивали код — проигнорируйте сообщение.",
				code,
			)
			if err := telegramapi.SendMessage(ctx, s.BotToken, tgText, *telegramID); err != nil {
				log.Printf("emailverify: telegram OTP tg_id=%d user_id=%d: %v (пользователь должен написать боту /start)", *telegramID, userID, err)
			} else {
				tgOK = true
			}
		}
	}

	var delivery string
	switch {
	case tgOK && smtpOK:
		delivery = DeliveryTelegramSMTP
	case tgOK:
		delivery = DeliveryTelegram
	case smtpOK:
		delivery = DeliverySMTP
	default:
		if s.StrictSMTP {
			log.Printf("emailverify: ни SMTP, ни Telegram; STRICT — отказ user_id=%d", userID)
			return nil, ErrSendFailed
		}
		log.Printf("WARNING emailverify: код только в логе (нет доставки). user_id=%d email=%s code=%s", userID, emailRaw, code)
		delivery = DeliveryLogOnly
	}

	log.Printf("emailverify: otp issued user_id=%d email=%s delivery=%s tg=%v smtp=%v", userID, emailRaw, delivery, tgOK, smtpOK)
	return &SendCodeResult{Delivery: delivery}, nil
}

func randomDigits(n int) (string, error) {
	if n <= 0 {
		return "", fmt.Errorf("invalid n")
	}
	var b []byte
	for len(b) < n {
		v, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		b = append(b, byte('0'+v.Int64()))
	}
	return string(b), nil
}

func (s *Service) VerifyCode(ctx context.Context, userID int64, emailRaw, code string) error {
	if s.Secret == "" {
		return ErrMissingSecret
	}
	emailNorm := NormalizeEmail(emailRaw)
	if !ValidateEmailFormat(emailNorm) {
		return ErrInvalidEmail
	}
	code = NormalizeDigits(code)
	if len(code) != 6 {
		return repository.ErrVerificationFailed
	}
	hash := HashOTP(s.Secret, emailNorm, userID, code)
	return repository.TryConsumeOTP(ctx, userID, emailNorm, hash, time.Now().UTC())
}

func NormalizeDigits(s string) string {
	var out []rune
	for _, r := range s {
		if r >= '0' && r <= '9' {
			out = append(out, r)
		}
	}
	return string(out)
}
