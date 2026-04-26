// Package identity — договорённости по user_id (этап 0 PWA) и вспомогательные
// проверки диапазонов. Схема без даунтайма: сначала сервер добавляет новый путь
// (session token), клиент на него переходит, затем снимается initData, когда
// эндпоинты перестают требовать его (см. RELOAAD.txt). Auth: email (основной
// для PWA) и Telegram (initData) выдают одну и ту же сессию — cabinet_auth_sessions.
package identity

// MinEmailOnlyUserID — нижняя граница id для «только email»-пользователей после
// миграции (users.id, sequence; см. RELOAAD этап 1). Не пересекается с реальными
// telegram_id и с отрицательным диапазоном cabinetDeviceId.
const MinEmailOnlyUserID int64 = 10_000_000_000

// IsTelegramID возвращает true, если id выглядит как реальный numeric Telegram
// user id (исторически: положительные значения, ниже зарезервированного email-only
// диапазона). Не путать с бизнес-проверкой «есть привязка к боту».
func IsTelegramID(id int64) bool {
	return id > 0 && id < MinEmailOnlyUserID
}

// IsSyntheticCabinetDeviceID — отрицательный int64 от UUID cabinetDeviceId
// (internal/webapp.SyntheticUserIDFromCabinetDevice).
func IsSyntheticCabinetDeviceID(id int64) bool {
	return id < 0
}

// IsEmailOnlyUserID — id из numeric sequence users для PWA-only после этапа 1.
func IsEmailOnlyUserID(id int64) bool {
	return id >= MinEmailOnlyUserID
}
