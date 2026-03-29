package db

import (
	"context"
	"fmt"
)

// EnsureCabinetAuthSessionsTable — сессии после подтверждения email (opaque token, хэш в БД).
func EnsureCabinetAuthSessionsTable(ctx context.Context) error {
	q := `
	CREATE TABLE IF NOT EXISTS cabinet_auth_sessions (
		id               BIGSERIAL PRIMARY KEY,
		token_hash       TEXT NOT NULL UNIQUE,
		user_id          BIGINT NOT NULL,
		email_normalized TEXT NOT NULL,
		expires_at       TIMESTAMPTZ NOT NULL,
		created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	`
	if _, err := Pool.ExecContext(ctx, q); err != nil {
		return fmt.Errorf("create cabinet_auth_sessions: %w", err)
	}
	_, err := Pool.ExecContext(ctx, `CREATE INDEX IF NOT EXISTS cabinet_auth_sessions_user_id ON cabinet_auth_sessions (user_id);`)
	if err != nil {
		return fmt.Errorf("index cabinet_auth_sessions: %w", err)
	}
	return nil
}
