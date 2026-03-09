package db

import (
	"context"
	"fmt"
)

// EnsureProfileTable создаёт таблицу mini_app_profiles, если её ещё нет.
// Хранит ФИО, дату рождения и Telegram ID пользователя мини‑приложения.
func EnsureProfileTable(ctx context.Context) error {
	q := `
	CREATE TABLE IF NOT EXISTS mini_app_profiles (
		telegram_id BIGINT PRIMARY KEY,
		full_name   TEXT NOT NULL,
		birth_date  TEXT NOT NULL,
		created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	`
	_, err := Pool.ExecContext(ctx, q)
	if err != nil {
		return fmt.Errorf("create table mini_app_profiles: %w", err)
	}
	return nil
}
