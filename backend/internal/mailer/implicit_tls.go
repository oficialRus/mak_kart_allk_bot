package mailer

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
)

// sendMailImplicitTLS — подключение сразу поверх TLS (типично порт 465).
func sendMailImplicitTLS(addr string, a smtp.Auth, from string, to []string, msg []byte, serverName string) error {
	dialer := &tls.Dialer{
		NetDialer: &net.Dialer{},
		Config: &tls.Config{
			ServerName: serverName,
			MinVersion: tls.VersionTLS12,
		},
	}
	conn, err := dialer.Dial("tcp", addr)
	if err != nil {
		return fmt.Errorf("tls dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, serverName)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	if a != nil {
		if ok, _ := client.Extension("AUTH"); ok {
			if err := client.Auth(a); err != nil {
				return fmt.Errorf("auth: %w", err)
			}
		}
	}

	envFrom := envelopeFrom(from)
	if err := client.Mail(envFrom); err != nil {
		return fmt.Errorf("mail from: %w", err)
	}
	for _, rcpt := range to {
		if err := client.Rcpt(rcpt); err != nil {
			return fmt.Errorf("rcpt %s: %w", rcpt, err)
		}
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("data: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return client.Quit()
}

func envelopeFrom(from string) string {
	from = strings.TrimSpace(from)
	if from == "" {
		return from
	}
	if addr, err := mail.ParseAddress(from); err == nil && addr.Address != "" {
		return addr.Address
	}
	return from
}
