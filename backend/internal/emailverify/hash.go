package emailverify

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
)

// HashOTP вычисляет HMAC-SHA256 от секрета приложения, нормализованного email, telegram_id и кода.
// Так короткий 6-значный код не сравнивается в открытом виде и привязан к получателю.
func HashOTP(secret, emailNormalized string, telegramID int64, code string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(strings.ToLower(strings.TrimSpace(emailNormalized))))
	_, _ = mac.Write([]byte("|"))
	_, _ = mac.Write([]byte(strconv.FormatInt(telegramID, 10)))
	_, _ = mac.Write([]byte("|"))
	_, _ = mac.Write([]byte(strings.TrimSpace(code)))
	return hex.EncodeToString(mac.Sum(nil))
}

func ConstantTimeEqualHash(a, b string) bool {
	// hex строки одинаковой длины
	if len(a) != len(b) {
		return false
	}
	var v byte
	for i := 0; i < len(a); i++ {
		v |= a[i] ^ b[i]
	}
	return v == 0
}
