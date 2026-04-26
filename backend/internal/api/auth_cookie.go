package api

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	cabinetSessionCookieName = "cabinet_session"
	cabinetCSRFCookieName    = "cabinet_csrf"
	cabinetCSRFHeaderName    = "X-CSRF-Token"
)

func cookieAuthEnabled() bool {
	v := strings.TrimSpace(os.Getenv("AUTH_USE_HTTPONLY_COOKIE"))
	return v == "1" || strings.EqualFold(v, "true")
}

func setCabinetAuthCookies(w http.ResponseWriter, token string, expiresAt time.Time) {
	if !cookieAuthEnabled() {
		return
	}
	secure := true
	http.SetCookie(w, &http.Cookie{
		Name:     cabinetSessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		Expires:  expiresAt,
		MaxAge:   int(time.Until(expiresAt).Seconds()),
	})
	csrf := make([]byte, 16)
	_, _ = rand.Read(csrf)
	http.SetCookie(w, &http.Cookie{
		Name:     cabinetCSRFCookieName,
		Value:    hex.EncodeToString(csrf),
		Path:     "/",
		HttpOnly: false,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		Expires:  expiresAt,
		MaxAge:   int(time.Until(expiresAt).Seconds()),
	})
}

func clearCabinetAuthCookies(w http.ResponseWriter) {
	if !cookieAuthEnabled() {
		return
	}
	for _, name := range []string{cabinetSessionCookieName, cabinetCSRFCookieName} {
		http.SetCookie(w, &http.Cookie{
			Name:     name,
			Value:    "",
			Path:     "/",
			HttpOnly: name == cabinetSessionCookieName,
			Secure:   true,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   -1,
			Expires:  time.Unix(0, 0),
		})
	}
}
