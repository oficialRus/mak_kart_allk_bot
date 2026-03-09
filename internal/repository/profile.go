package repository

import (
	"context"
	"mak_kart_allk_bot/internal/db"
)

// SaveProfile сохраняет или обновляет профиль пользователя мини‑приложения.
func SaveProfile(ctx context.Context, telegramID int64, fullName, birthDate string) error {
	q := `
	INSERT INTO mini_app_profiles (telegram_id, full_name, birth_date)
	VALUES ($1, $2, $3)
	ON CONFLICT (telegram_id) DO UPDATE SET
		full_name  = EXCLUDED.full_name,
		birth_date = EXCLUDED.birth_date,
		updated_at = NOW();
	`
	_, err := db.Pool.ExecContext(ctx, q, telegramID, fullName, birthDate)
	return err
}
