package repository

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"errors"
	"log"
	"time"

	"mak_kart_allk_bot/internal/db"
)

// ErrVerificationFailed — неверный/просроченый код или лимит попыток (для клиента один ответ).
var ErrVerificationFailed = errors.New("verification failed")

// InvalidatePendingForTelegram помечает все незавершённые коды пользователя как недействительные.
func InvalidatePendingForTelegram(ctx context.Context, telegramID int64) error {
	q := `
	UPDATE email_verifications
	SET invalidated_at = NOW(), updated_at = NOW()
	WHERE telegram_id = $1
	  AND verified_at IS NULL
	  AND invalidated_at IS NULL;
	`
	_, err := db.Pool.ExecContext(ctx, q, telegramID)
	return err
}

// InsertEmailVerification создаёт новую запись кода.
func InsertEmailVerification(ctx context.Context, telegramID int64, email, emailNorm, codeHash string, expiresAt time.Time, maxAttempts int, lastSent time.Time) (int64, error) {
	q := `
	INSERT INTO email_verifications (
		telegram_id, email, email_normalized, code_hash, expires_at, attempts, max_attempts, last_sent_at
	) VALUES ($1, $2, $3, $4, $5, 0, $6, $7)
	RETURNING id;
	`
	var id int64
	err := db.Pool.QueryRowContext(ctx, q, telegramID, email, emailNorm, codeHash, expiresAt, maxAttempts, lastSent).Scan(&id)
	return id, err
}

// LastSendTimeForTelegram — время последней отправки кода этому telegram (любой email).
func LastSendTimeForTelegram(ctx context.Context, telegramID int64) (*time.Time, error) {
	q := `SELECT MAX(last_sent_at) FROM email_verifications WHERE telegram_id = $1;`
	var t sql.NullTime
	if err := db.Pool.QueryRowContext(ctx, q, telegramID).Scan(&t); err != nil {
		return nil, err
	}
	if !t.Valid {
		return nil, nil
	}
	return &t.Time, nil
}

// LastSendTimeForEmail — время последней отправки на этот нормализованный email (любой пользователь).
func LastSendTimeForEmail(ctx context.Context, emailNormalized string) (*time.Time, error) {
	q := `SELECT MAX(last_sent_at) FROM email_verifications WHERE email_normalized = $1;`
	var t sql.NullTime
	if err := db.Pool.QueryRowContext(ctx, q, emailNormalized).Scan(&t); err != nil {
		return nil, err
	}
	if !t.Valid {
		return nil, nil
	}
	return &t.Time, nil
}

// CountSendsTelegramSince считает созданные записи за окно (отправки кода).
func CountSendsTelegramSince(ctx context.Context, telegramID int64, since time.Time) (int, error) {
	q := `SELECT COUNT(*) FROM email_verifications WHERE telegram_id = $1 AND created_at >= $2;`
	var n int
	if err := db.Pool.QueryRowContext(ctx, q, telegramID, since).Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}

// CountSendsEmailSince — сколько раз отправляли код на этот email за окно.
func CountSendsEmailSince(ctx context.Context, emailNormalized string, since time.Time) (int, error) {
	q := `SELECT COUNT(*) FROM email_verifications WHERE email_normalized = $1 AND created_at >= $2;`
	var n int
	if err := db.Pool.QueryRowContext(ctx, q, emailNormalized, since).Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}

// TryConsumeOTP в одной транзакции проверяет код, лимиты, занятость email и сохраняет verified в профиле.
// Параметр userID — логический user_id (исторически хранится в колонке telegram_id).
func TryConsumeOTP(ctx context.Context, userID int64, emailNormalized, codeHashHex string, now time.Time) error {
	tx, err := db.Pool.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var (
		id          int64
		storedHash  string
		expiresAt   time.Time
		attempts    int
		maxAttempts int
	)
	q := `
	SELECT id, code_hash, expires_at, attempts, max_attempts
	FROM email_verifications
	WHERE telegram_id = $1
	  AND email_normalized = $2
	  AND verified_at IS NULL
	  AND invalidated_at IS NULL
	ORDER BY id DESC
	LIMIT 1
	FOR UPDATE;
	`
	err = tx.QueryRowContext(ctx, q, userID, emailNormalized).Scan(&id, &storedHash, &expiresAt, &attempts, &maxAttempts)
	if err == sql.ErrNoRows {
		return ErrVerificationFailed
	}
	if err != nil {
		return err
	}

	bumpFail := func() error {
		_, _ = tx.ExecContext(ctx, `
			UPDATE email_verifications SET attempts = attempts + 1, updated_at = NOW()
			WHERE id = $1 AND verified_at IS NULL AND invalidated_at IS NULL;
		`, id)
		_ = tx.Commit()
		return ErrVerificationFailed
	}

	// Просрочен или лимит попыток — без увеличения attempts (отдельно от неверного кода).
	if !now.Before(expiresAt) || attempts >= maxAttempts {
		return ErrVerificationFailed
	}

	storedBytes, err := hex.DecodeString(storedHash)
	if err != nil {
		return err
	}
	givenBytes, err := hex.DecodeString(codeHashHex)
	if err != nil || len(storedBytes) != len(givenBytes) {
		return bumpFail()
	}
	if subtle.ConstantTimeCompare(storedBytes, givenBytes) != 1 {
		return bumpFail()
	}

	var otherOwner int64
	err = tx.QueryRowContext(ctx, `
		SELECT telegram_id FROM mini_app_profiles
		WHERE lower(trim(email)) = $1
		  AND email_verified_at IS NOT NULL
		  AND trim(email) <> ''
		  AND telegram_id <> $2
		LIMIT 1;
	`, emailNormalized, userID).Scan(&otherOwner)
	if err != nil && err != sql.ErrNoRows {
		return err
	}
	if err == nil {
		log.Printf("emailverify: merge blocked, verified email already belongs to user_id=%d (current user_id=%d)", otherOwner, userID)
		return bumpFail()
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO mini_app_profiles (telegram_id, full_name, birth_date, phone, learning_level, learning_goal, learning_format, email, email_verified_at)
		VALUES ($1, '', '', '', '', '', '', $2, NOW())
		ON CONFLICT (telegram_id) DO UPDATE SET
			email = EXCLUDED.email,
			email_verified_at = EXCLUDED.email_verified_at,
			updated_at = NOW();
	`, userID, emailNormalized)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE email_verifications SET verified_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND verified_at IS NULL AND invalidated_at IS NULL;
	`, id)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE email_verifications
		SET invalidated_at = NOW(), updated_at = NOW()
		WHERE email_normalized = $1
		  AND id <> $2
		  AND verified_at IS NULL
		  AND invalidated_at IS NULL;
	`, emailNormalized, id)
	if err != nil {
		return err
	}

	return tx.Commit()
}
