package mailer

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net"
	"net/smtp"
	"strconv"
	"strings"
)

// EmailMessage — тема и тело; HTML необязателен (тогда уходит только text/plain).
type EmailMessage struct {
	Subject string
	Text    string
	HTML    string
}

// Sender отвечает за доставку писем; реализации можно подменить (SendGrid, SES и т.д.).
type Sender interface {
	Send(ctx context.Context, to []string, msg EmailMessage) error
}

// SmtpConfig — параметры подключения к SMTP.
type SmtpConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	From     string
	// UseTLS: STARTTLS после plain-соединения (обычно порт 587).
	UseTLS bool
	// ImplicitTLS: сразу TLS (обычно порт 465). Если true, UseTLS не используется.
	ImplicitTLS bool
}

// SmtpSender отправка через net/smtp + STARTTLS при необходимости.
type SmtpSender struct {
	cfg SmtpConfig
}

func NewSmtp(cfg SmtpConfig) (*SmtpSender, error) {
	if strings.TrimSpace(cfg.Host) == "" {
		return nil, fmt.Errorf("smtp host is empty")
	}
	if cfg.Port <= 0 {
		cfg.Port = 587
	}
	from := strings.TrimSpace(cfg.From)
	if from == "" {
		return nil, fmt.Errorf("smtp from is empty")
	}
	return &SmtpSender{cfg: cfg}, nil
}

func (s *SmtpSender) Send(ctx context.Context, to []string, msg EmailMessage) error {
	if len(to) == 0 {
		return fmt.Errorf("no recipients")
	}
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	addr := net.JoinHostPort(s.cfg.Host, strconv.Itoa(s.cfg.Port))
	var auth smtp.Auth
	if strings.TrimSpace(s.cfg.User) != "" {
		auth = smtp.PlainAuth("", s.cfg.User, s.cfg.Password, s.cfg.Host)
	}

	raw := buildRFC822Message(s.cfg.From, to, msg)

	var err error
	switch {
	case s.cfg.ImplicitTLS:
		err = sendMailImplicitTLS(addr, auth, s.cfg.From, to, []byte(raw), s.cfg.Host)
	case s.cfg.UseTLS:
		err = sendMailSTARTTLS(addr, auth, s.cfg.From, to, []byte(raw), s.cfg.Host)
	default:
		err = smtp.SendMail(addr, auth, envelopeFrom(s.cfg.From), to, []byte(raw))
	}
	if err != nil {
		return fmt.Errorf("smtp send: %w", err)
	}
	return nil
}

func buildRFC822Message(from string, to []string, msg EmailMessage) string {
	if strings.TrimSpace(msg.HTML) == "" {
		return buildRFC822(from, to, msg.Subject, msg.Text)
	}
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	boundary := "garmonia-" + hex.EncodeToString(buf)

	var b strings.Builder
	b.WriteString("From: " + from + "\r\n")
	b.WriteString("To: " + strings.Join(to, ", ") + "\r\n")
	b.WriteString("Subject: " + encodeSubject(msg.Subject) + "\r\n")
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: multipart/alternative; boundary=\"" + boundary + "\"\r\n")
	b.WriteString("\r\n")
	b.WriteString("--" + boundary + "\r\n")
	b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	b.WriteString("Content-Transfer-Encoding: 8bit\r\n")
	b.WriteString("\r\n")
	b.WriteString(msg.Text)
	b.WriteString("\r\n")
	b.WriteString("--" + boundary + "\r\n")
	b.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	b.WriteString("Content-Transfer-Encoding: 8bit\r\n")
	b.WriteString("\r\n")
	b.WriteString(msg.HTML)
	b.WriteString("\r\n")
	b.WriteString("--" + boundary + "--\r\n")
	return b.String()
}

func buildRFC822(from string, to []string, subject, body string) string {
	var b strings.Builder
	b.WriteString("From: " + from + "\r\n")
	b.WriteString("To: " + strings.Join(to, ", ") + "\r\n")
	b.WriteString("Subject: " + encodeSubject(subject) + "\r\n")
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	b.WriteString("Content-Transfer-Encoding: 8bit\r\n")
	b.WriteString("\r\n")
	b.WriteString(body)
	b.WriteString("\r\n")
	return b.String()
}

// encodeSubject минимальная UTF-8 кодировка для не-ASCII темы.
func encodeSubject(s string) string {
	if s == "" {
		return ""
	}
	needs := false
	for _, r := range s {
		if r > 127 {
			needs = true
			break
		}
	}
	if !needs {
		return s
	}
	return "=?UTF-8?B?" + base64.StdEncoding.EncodeToString([]byte(s)) + "?="
}
