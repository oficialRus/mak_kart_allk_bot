package db

import (
	"context"
	"fmt"

	"mak_kart_allk_bot/internal/identity"
)

// EnsureUsersTable создаёт users как единый источник правды user_id.
// Миграция аддитивная: без FK и без удаления legacy-колонок.
func EnsureUsersTable(ctx context.Context) error {
	if _, err := Pool.ExecContext(ctx, `CREATE EXTENSION IF NOT EXISTS citext;`); err != nil {
		return fmt.Errorf("create extension citext: %w", err)
	}

	q := `
	CREATE TABLE IF NOT EXISTS users (
		id                     BIGSERIAL PRIMARY KEY,
		telegram_id            BIGINT UNIQUE,
		email                  CITEXT UNIQUE,
		email_verified_at      TIMESTAMPTZ NULL,
		cabinet_device_user_id BIGINT UNIQUE,
		created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	`
	if _, err := Pool.ExecContext(ctx, q); err != nil {
		return fmt.Errorf("create users table: %w", err)
	}
	if _, err := Pool.ExecContext(ctx, `CREATE INDEX IF NOT EXISTS users_email_verified_idx ON users (email_verified_at);`); err != nil {
		return fmt.Errorf("index users_email_verified_idx: %w", err)
	}
	if _, err := Pool.ExecContext(ctx, `CREATE INDEX IF NOT EXISTS users_telegram_id_idx ON users (telegram_id);`); err != nil {
		return fmt.Errorf("index users_telegram_id_idx: %w", err)
	}
	if _, err := Pool.ExecContext(ctx, `CREATE INDEX IF NOT EXISTS users_cabinet_device_user_id_idx ON users (cabinet_device_user_id);`); err != nil {
		return fmt.Errorf("index users_cabinet_device_user_id_idx: %w", err)
	}

	// Устанавливаем следующий id в безопасный диапазон email-only (>= 10^10),
	// но не ниже текущего максимального id + 1.
	if _, err := Pool.ExecContext(ctx, `
		SELECT setval(
			pg_get_serial_sequence('users', 'id'),
			GREATEST((SELECT COALESCE(MAX(id), 0) + 1 FROM users), $1),
			false
		);
	`, identity.MinEmailOnlyUserID); err != nil {
		return fmt.Errorf("set users id sequence: %w", err)
	}

	return nil
}

// BackfillUsersFromLegacy мягко переносит существующие identity в users.
// Для legacy пользователей сохраняем тот же user_id (users.id = старый id).
func BackfillUsersFromLegacy(ctx context.Context) error {
	// Положительные telegram_id + подтверждённый email из mini_app_profiles.
	if _, err := Pool.ExecContext(ctx, `
		INSERT INTO users (id, telegram_id, email, email_verified_at)
		SELECT
			p.telegram_id,
			p.telegram_id,
			CASE
				WHEN p.email_verified_at IS NOT NULL AND trim(p.email) <> '' THEN lower(trim(p.email))
				ELSE NULL
			END,
			p.email_verified_at
		FROM mini_app_profiles p
		WHERE p.telegram_id > 0
		ON CONFLICT (id) DO UPDATE
		SET
			telegram_id = COALESCE(users.telegram_id, EXCLUDED.telegram_id),
			email = COALESCE(users.email, EXCLUDED.email),
			email_verified_at = COALESCE(users.email_verified_at, EXCLUDED.email_verified_at),
			updated_at = NOW();
	`); err != nil {
		return fmt.Errorf("backfill users from mini_app_profiles telegram ids: %w", err)
	}

	// Отрицательные synthetic user_id из cabinet sessions и profile.
	if _, err := Pool.ExecContext(ctx, `
		INSERT INTO users (id, cabinet_device_user_id)
		SELECT x.user_id, x.user_id
		FROM (
			SELECT DISTINCT s.user_id
			FROM cabinet_auth_sessions s
			WHERE s.user_id < 0
			UNION
			SELECT DISTINCT p.telegram_id AS user_id
			FROM mini_app_profiles p
			WHERE p.telegram_id < 0
		) AS x
		ON CONFLICT (id) DO UPDATE
		SET
			cabinet_device_user_id = COALESCE(users.cabinet_device_user_id, EXCLUDED.cabinet_device_user_id),
			updated_at = NOW();
	`); err != nil {
		return fmt.Errorf("backfill users synthetic ids: %w", err)
	}

	return nil
}
