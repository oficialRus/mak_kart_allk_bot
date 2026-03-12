package db

import (
	"context"
	"fmt"
)

// EnsureDailyNumberTable создаёт таблицу mini_app_daily_numbers, если её ещё нет.
// В ней хранится "цифра дня" для каждого пользователя Telegram на конкретную дату.
func EnsureDailyNumberTable(ctx context.Context) error {
	q := `
	CREATE TABLE IF NOT EXISTS mini_app_daily_numbers (
		telegram_id BIGINT NOT NULL,
		for_date    DATE   NOT NULL,
		number      INT    NOT NULL,
		created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		PRIMARY KEY (telegram_id, for_date)
	);
	`
	if _, err := Pool.ExecContext(ctx, q); err != nil {
		return fmt.Errorf("create table mini_app_daily_numbers: %w", err)
	}

	return nil
}

