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
	LearningLevel  string
	LearningGoal   string
	LearningFormat string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// GetProfile возвращает профиль пользователя по telegram_id или nil, если записи нет.
func GetProfile(ctx context.Context, telegramID int64) (*Profile, error) {
	q := `
	SELECT telegram_id, full_name, birth_date, phone, learning_level, learning_goal, learning_format, created_at, updated_at
	FROM mini_app_profiles
	WHERE telegram_id = $1;
	`
	row := db.Pool.QueryRowContext(ctx, q, telegramID)

	var p Profile
	if err := row.Scan(
		&p.TelegramID,
		&p.FullName,
		&p.BirthDate,
		&p.Phone,
		&p.LearningLevel,
		&p.LearningGoal,
		&p.LearningFormat,
		&p.CreatedAt,
		&p.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

// SaveProfile сохраняет или обновляет профиль пользователя.
// phone может быть пустой строкой (например, из мини‑приложения, где телефон не запрашивается).
func SaveProfile(ctx context.Context, telegramID int64, fullName, birthDate, phone, learningLevel, learningGoal, learningFormat string) error {
	q := `
	INSERT INTO mini_app_profiles (telegram_id, full_name, birth_date, phone, learning_level, learning_goal, learning_format)
	VALUES ($1, $2, $3, $4, $5, $6, $7)
	ON CONFLICT (telegram_id) DO UPDATE SET
		full_name  = CASE WHEN EXCLUDED.full_name = '' THEN mini_app_profiles.full_name ELSE EXCLUDED.full_name END,
		birth_date = CASE WHEN EXCLUDED.birth_date = '' THEN mini_app_profiles.birth_date ELSE EXCLUDED.birth_date END,
		phone      = CASE WHEN EXCLUDED.phone = '' THEN mini_app_profiles.phone ELSE EXCLUDED.phone END,
		learning_level = CASE WHEN EXCLUDED.learning_level = '' THEN mini_app_profiles.learning_level ELSE EXCLUDED.learning_level END,
		learning_goal = CASE WHEN EXCLUDED.learning_goal = '' THEN mini_app_profiles.learning_goal ELSE EXCLUDED.learning_goal END,
		learning_format = CASE WHEN EXCLUDED.learning_format = '' THEN mini_app_profiles.learning_format ELSE EXCLUDED.learning_format END,
		updated_at = NOW();
	`
	_, err := db.Pool.ExecContext(ctx, q, telegramID, fullName, birthDate, phone, learningLevel, learningGoal, learningFormat)
	return err
}
