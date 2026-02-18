package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
	"mak_kart_bot/internal/models"
)

type UserRepository struct {
	db *sqlx.DB
}

func NewUserRepository(db *sqlx.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) GetByTelegramID(ctx context.Context, telegramID int64) (*models.User, error) {
	var user models.User
	err := r.db.GetContext(ctx, &user, `SELECT * FROM users WHERE telegram_id = $1`, telegramID)
	if err != nil {
		return nil, fmt.Errorf("get user by telegram_id: %w", err)
	}
	return &user, nil
}

func (r *UserRepository) Create(ctx context.Context, user *models.User) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO users (telegram_id, username, full_name, level, quiz_skipped)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (telegram_id) DO NOTHING`,
		user.TelegramID, user.Username, user.FullName, user.Level, user.QuizSkipped,
	)
	return err
}

func (r *UserRepository) UpdateLevel(ctx context.Context, telegramID int64, level models.UserLevel, answers []byte, skipped bool) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE users SET level = $1, quiz_answers = $2, quiz_skipped = $3, updated_at = $4
		WHERE telegram_id = $5`,
		level, answers, skipped, time.Now(), telegramID,
	)
	return err
}
