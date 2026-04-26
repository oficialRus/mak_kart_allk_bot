package repository

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"time"

	"mak_kart_allk_bot/internal/db"
)

func hashCabinetSessionToken(pepper, plain string) string {
	h := sha256.Sum256([]byte("cabinet_sess_v1\x00" + pepper + "\x00" + plain))
	return hex.EncodeToString(h[:])
}

// CreateCabinetSession удаляет старые сессии пользователя, создаёт новую. plainToken показать клиенту один раз.
func CreateCabinetSession(ctx context.Context, userID int64, emailNormalized, pepper string, ttl time.Duration) (plainToken string, expiresAt time.Time, err error) {
	if ttl <= 0 {
		ttl = 30 * 24 * time.Hour
	}
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", time.Time{}, err
	}
	plainToken = hex.EncodeToString(b)
	th := hashCabinetSessionToken(pepper, plainToken)
	expiresAt = time.Now().UTC().Add(ttl)

	tx, err := db.Pool.BeginTx(ctx, nil)
	if err != nil {
		return "", time.Time{}, err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `DELETE FROM cabinet_auth_sessions WHERE user_id = $1`, userID); err != nil {
		return "", time.Time{}, err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO cabinet_auth_sessions (token_hash, user_id, email_normalized, expires_at)
		VALUES ($1, $2, $3, $4)
	`, th, userID, emailNormalized, expiresAt); err != nil {
		return "", time.Time{}, err
	}
	if err := tx.Commit(); err != nil {
		return "", time.Time{}, err
	}
	return plainToken, expiresAt, nil
}

// ValidateCabinetSessionToken возвращает user_id, если токен действителен.
func ValidateCabinetSessionToken(ctx context.Context, plainToken, pepper string) (userID int64, ok bool, err error) {
	if plainToken == "" {
		return 0, false, nil
	}
	th := hashCabinetSessionToken(pepper, plainToken)
	var uid int64
	q := `SELECT user_id FROM cabinet_auth_sessions WHERE token_hash = $1 AND expires_at > NOW() LIMIT 1;`
	err = db.Pool.QueryRowContext(ctx, q, th).Scan(&uid)
	if err == sql.ErrNoRows {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	return uid, true, nil
}

// RevokeCabinetSessionByToken удаляет сессию (выход).
func RevokeCabinetSessionByToken(ctx context.Context, plainToken, pepper string) error {
	if plainToken == "" {
		return nil
	}
	th := hashCabinetSessionToken(pepper, plainToken)
	_, err := db.Pool.ExecContext(ctx, `DELETE FROM cabinet_auth_sessions WHERE token_hash = $1`, th)
	return err
}

// RevokeAllCabinetSessionsForUser — все сессии пользователя.
func RevokeAllCabinetSessionsForUser(ctx context.Context, userID int64) error {
	_, err := db.Pool.ExecContext(ctx, `DELETE FROM cabinet_auth_sessions WHERE user_id = $1`, userID)
	return err
}
