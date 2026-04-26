package emailverify

import (
	"net/mail"
	"strings"
)

const (
	maxEmailLen = 254
)

// NormalizeEmail приводит email к нижнему регистру и обрезает пробелы.
func NormalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// ValidateEmailFormat проверяет длину и парсинг адреса.
func ValidateEmailFormat(email string) bool {
	if email == "" || len(email) > maxEmailLen {
		return false
	}
	addr, err := mail.ParseAddress(email)
	if err != nil {
		return false
	}
	at := strings.LastIndex(addr.Address, "@")
	if at <= 0 || at == len(addr.Address)-1 {
		return false
	}
	local := addr.Address[:at]
	domain := addr.Address[at+1:]
	if local == "" || domain == "" || strings.Contains(domain, "..") {
		return false
	}
	return true
}
