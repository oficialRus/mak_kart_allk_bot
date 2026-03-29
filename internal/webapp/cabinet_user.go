package webapp

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"regexp"
	"strings"
)

// UUID в нижнем/верхнем регистре (как у crypto.randomUUID в браузере).
var cabinetDeviceUUID = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// ResolveCabinetUserID определяет идентификатор для привязки email к кабинету (OTP, сессия).
// Сначала валидный cabinetDeviceId — один и тот же email не «ломается» при открытии мини‑приложения из Telegram
// (иначе initData давал бы другой telegram_id, чем при входе только с UUID в браузере).
// Иначе: initData → реальный telegram_id. Fallback для клиентов без UUID.
func ResolveCabinetUserID(botToken, initData, cabinetDeviceID string) (int64, error) {
	id := strings.TrimSpace(cabinetDeviceID)
	if id != "" {
		if !cabinetDeviceUUID.MatchString(id) {
			return 0, fmt.Errorf("invalid cabinetDeviceId")
		}
		return SyntheticUserIDFromCabinetDevice(id), nil
	}
	initData = strings.TrimSpace(initData)
	if initData != "" {
		return ValidateInitData(botToken, initData)
	}
	return 0, fmt.Errorf("initData or cabinetDeviceId required")
}

func SyntheticUserIDFromCabinetDevice(cabinetDeviceID string) int64 {
	const prefix = "garmonia_cabinet_device_v1"
	h := sha256.Sum256([]byte(prefix + "\x00" + strings.ToLower(strings.TrimSpace(cabinetDeviceID))))
	v := binary.BigEndian.Uint64(h[:8])
	n := int64(v & 0x7fff_ffff_ffff_ffff)
	if n == 0 {
		n = 1
	}
	return -n
}
