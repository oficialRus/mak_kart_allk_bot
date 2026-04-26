package db

import (
	"context"
	"fmt"
)

// EnsureCardDayTables создаёт таблицы для раздела «Карта дня»:
// card_day_cards — хранилище карт, card_day_history — история выдачи пользователям.
func EnsureCardDayTables(ctx context.Context) error {
	cards := `
	CREATE TABLE IF NOT EXISTS card_day_cards (
		id          SERIAL PRIMARY KEY,
		image_path  TEXT NOT NULL,
		title       TEXT NOT NULL DEFAULT '',
		description TEXT NOT NULL DEFAULT '',
		is_active   BOOLEAN NOT NULL DEFAULT TRUE,
		created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);`
	if _, err := Pool.ExecContext(ctx, cards); err != nil {
		return fmt.Errorf("create table card_day_cards: %w", err)
	}

	history := `
	CREATE TABLE IF NOT EXISTS card_day_history (
		id            SERIAL PRIMARY KEY,
		user_id       BIGINT NOT NULL,
		card_id       INT NOT NULL REFERENCES card_day_cards(id),
		assigned_date DATE NOT NULL,
		created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		UNIQUE (user_id, assigned_date)
	);`
	if _, err := Pool.ExecContext(ctx, history); err != nil {
		return fmt.Errorf("create table card_day_history: %w", err)
	}

	idx := `CREATE INDEX IF NOT EXISTS idx_card_day_history_user_date
	        ON card_day_history (user_id, assigned_date);`
	if _, err := Pool.ExecContext(ctx, idx); err != nil {
		return fmt.Errorf("create index idx_card_day_history_user_date: %w", err)
	}

	alter := `ALTER TABLE card_day_history ADD COLUMN IF NOT EXISTS day_message TEXT;`
	if _, err := Pool.ExecContext(ctx, alter); err != nil {
		return fmt.Errorf("alter card_day_history day_message: %w", err)
	}

	return nil
}
