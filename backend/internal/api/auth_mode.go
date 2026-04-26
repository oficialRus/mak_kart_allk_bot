package api

import (
	"os"
	"strings"
)

type authMode string

const (
	authModeHybrid       authMode = "hybrid"
	authModeEmailOnly    authMode = "email_only"
	authModeTelegramOnly authMode = "telegram_only"
)

func currentAuthMode() authMode {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("AUTH_MODE")))
	switch authMode(v) {
	case authModeEmailOnly, authModeTelegramOnly:
		return authMode(v)
	default:
		return authModeHybrid
	}
}
