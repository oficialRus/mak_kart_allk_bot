package repository

import (
	"context"
	"database/sql"
	"time"

	"mak_kart_allk_bot/internal/db"
)

// Profile описывает строку из mini_app_profiles.
type Profile struct {
	TelegramID int64
	FullName   string
	BirthDate  string
	Phone      string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// GetProfile возвращает профиль пользователя по telegram_id или nil, если записи нет.
func GetProfile(ctx context.Context, telegramID int64) (*Profile, error) {
	q := `
	SELECT telegram_id, full_name, birth_date, phone, created_at, updated_at
	FROM mini_app_profiles
	WHERE telegram_id = $1;
	`
	row := db.Pool.QueryRowContext(ctx, q, telegramID)

	var p Profile
	if err := row.Scan(&p.TelegramID, &p.FullName, &p.BirthDate, &p.Phone, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

// SaveProfile сохраняет или обновляет профиль пользователя.
// phone может быть пустой строкой (например, из мини‑приложения, где телефон не запрашивается).
func SaveProfile(ctx context.Context, telegramID int64, fullName, birthDate, phone string) error {
	q := `
	INSERT INTO mini_app_profiles (telegram_id, full_name, birth_date, phone)
	VALUES ($1, $2, $3, $4)
	ON CONFLICT (telegram_id) DO UPDATE SET
		full_name  = EXCLUDED.full_name,
		birth_date = EXCLUDED.birth_date,
		phone      = CASE WHEN EXCLUDED.phone = '' THEN mini_app_profiles.phone ELSE EXCLUDED.phone END,
		updated_at = NOW();
	`
	_, err := db.Pool.ExecContext(ctx, q, telegramID, fullName, birthDate, phone)
	return err
}
