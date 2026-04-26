package db

import (
	"context"
	"fmt"
)

// EnsureDailyAffirmationTable создаёт таблицу для кеша «аффирмации дня»
// по пользователю и дате (по МСК).
func EnsureDailyAffirmationTable(ctx context.Context) error {
	q := `
	CREATE TABLE IF NOT EXISTS mini_app_daily_affirmations (
		telegram_id BIGINT NOT NULL,
		for_date    DATE   NOT NULL,
		affirmation TEXT   NOT NULL,
		created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		PRIMARY KEY (telegram_id, for_date)
	);
	`
	if _, err := Pool.ExecContext(ctx, q); err != nil {
		return fmt.Errorf("create table mini_app_daily_affirmations: %w", err)
	}
	return nil
}

