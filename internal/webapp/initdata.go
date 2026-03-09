package webapp

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
)

// ValidateInitData проверяет подпись Telegram WebApp initData и возвращает user_id.
// Алгоритм: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
func ValidateInitData(botToken, initData string) (telegramUserID int64, err error) {
	if initData == "" {
		return 0, fmt.Errorf("initData is empty")
	}

	vals, err := url.ParseQuery(initData)
	if err != nil {
		return 0, fmt.Errorf("parse initData: %w", err)
	}

	hash := vals.Get("hash")
	vals.Del("hash")
	if hash == "" {
		return 0, fmt.Errorf("hash missing in initData")
	}

	// data-check-string: пары key=value, отсортированные по ключу, через \n
	keys := make([]string, 0, len(vals))
	for k := range vals {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var sb strings.Builder
	for i, k := range keys {
		if i > 0 {
			sb.WriteByte('\n')
		}
		sb.WriteString(k)
		sb.WriteByte('=')
		sb.WriteString(vals.Get(k))
	}
	dataCheckString := sb.String()

	// secret_key = HMAC-SHA256(bot_token, "WebAppData")
	mac := hmac.New(sha256.New, []byte(botToken))
	mac.Write([]byte("WebAppData"))
	secretKey := mac.Sum(nil)

	// computed_hash = HMAC-SHA256(secret_key, data_check_string)
	mac2 := hmac.New(sha256.New, secretKey)
	mac2.Write([]byte(dataCheckString))
	computedHash := hex.EncodeToString(mac2.Sum(nil))

	if !hmac.Equal([]byte(computedHash), []byte(hash)) {
		return 0, fmt.Errorf("invalid initData signature")
	}

	// Извлекаем user_id из поля user (JSON)
	userStr := vals.Get("user")
	if userStr == "" {
		return 0, fmt.Errorf("user missing in initData")
	}
	var user struct {
		ID int64 `json:"id"`
	}
	if err := json.Unmarshal([]byte(userStr), &user); err != nil {
		return 0, fmt.Errorf("parse user from initData: %w", err)
	}
	if user.ID == 0 {
		return 0, fmt.Errorf("user.id is zero")
	}
	return user.ID, nil
}

// ParseUserIDFromInitDataUnsafe извлекает user_id из initData без проверки подписи.
// Использовать только для отладки или если проверка выполняется иначе.
func ParseUserIDFromInitDataUnsafe(initData string) (int64, error) {
	vals, err := url.ParseQuery(initData)
	if err != nil {
		return 0, err
	}
	userStr := vals.Get("user")
	if userStr == "" {
		return 0, fmt.Errorf("user missing")
	}
	var user struct {
		ID int64 `json:"id"`
	}
	if err := json.Unmarshal([]byte(userStr), &user); err != nil {
		return 0, err
	}
	return user.ID, nil
}
