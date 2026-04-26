package db

import (
	"context"
	"fmt"
)

// EnsureDialogsTable создаёт таблицу mini_app_dialogs, если её ещё нет.
// В ней хранятся сохранённые разборы/диалоги мини‑приложения.
func EnsureDialogsTable(ctx context.Context) error {
	q := `
	CREATE TABLE IF NOT EXISTS mini_app_dialogs (
		id          BIGSERIAL PRIMARY KEY,
		telegram_id BIGINT      NOT NULL,
		mode        TEXT        NOT NULL,
		title       TEXT        NOT NULL,
		messages    JSONB       NOT NULL,
		created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_mini_app_dialogs_telegram_id_created_at
		ON mini_app_dialogs (telegram_id, created_at DESC);
	`
	if _, err := Pool.ExecContext(ctx, q); err != nil {
		return fmt.Errorf("create table mini_app_dialogs: %w", err)
	}
	return nil
}

