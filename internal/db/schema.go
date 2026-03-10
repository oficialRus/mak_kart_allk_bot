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
		phone       TEXT NOT NULL DEFAULT '',
		created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	`
	if _, err := Pool.ExecContext(ctx, q); err != nil {
		return fmt.Errorf("create table mini_app_profiles: %w", err)
	}

	// Добавляем колонку phone, если таблица уже существовала без неё.
	alter := `ALTER TABLE mini_app_profiles ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';`
	if _, err := Pool.ExecContext(ctx, alter); err != nil {
		return fmt.Errorf("alter table add phone: %w", err)
	}

	return nil
}
