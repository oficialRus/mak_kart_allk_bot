package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"mak_kart_allk_bot/internal/db"
	"mak_kart_allk_bot/internal/emailverify"
	"mak_kart_allk_bot/internal/identity"
)

var (
	ErrUserNotFound        = errors.New("user not found")
	ErrEmailAlreadyLinked  = errors.New("email linked to another user")
	ErrTelegramAlreadyUsed = errors.New("telegram id linked to another user")
)

// ResolveByTelegram возвращает единый user_id по telegram_id.
// Для legacy-пользователей user_id = telegram_id.
func ResolveByTelegram(ctx context.Context, telegramID int64) (int64, error) {
	if !identity.IsTelegramID(telegramID) {
		return 0, fmt.Errorf("invalid telegram id: %d", telegramID)
	}
	if id, ok, err := findUserByTelegram(ctx, telegramID); err != nil {
		return 0, err
	} else if ok {
		return id, nil
	}
	if _, err := db.Pool.ExecContext(ctx, `
		INSERT INTO users (id, telegram_id)
		VALUES ($1, $1)
		ON CONFLICT (id) DO UPDATE
		SET telegram_id = COALESCE(users.telegram_id, EXCLUDED.telegram_id), updated_at = NOW();
	`, telegramID); err != nil {
		return 0, err
	}
	return telegramID, nil
}

// ResolveByEmail ищет только подтверждённую связь email -> user_id.
func ResolveByEmail(ctx context.Context, email string) (int64, error) {
	emailNorm := emailverify.NormalizeEmail(email)
	if !emailverify.ValidateEmailFormat(emailNorm) {
		return 0, emailverify.ErrInvalidEmail
	}
	var userID int64
	err := db.Pool.QueryRowContext(ctx, `
		SELECT id
		FROM users
		WHERE lower(trim(email::text)) = $1
		  AND email_verified_at IS NOT NULL
		LIMIT 1;
	`, emailNorm).Scan(&userID)
	if err == nil {
		return userID, nil
	}
	if err != sql.ErrNoRows {
		return 0, err
	}

	// Legacy fallback: часть аккаунтов могла быть подтверждена только в mini_app_profiles.
	// Это позволяет войти с другого устройства тем же email и получить тот же user_id.
	err = db.Pool.QueryRowContext(ctx, `
		SELECT telegram_id
		FROM mini_app_profiles
		WHERE lower(trim(email)) = $1
		  AND email_verified_at IS NOT NULL
		  AND trim(email) <> ''
		LIMIT 1;
	`, emailNorm).Scan(&userID)
	if err == sql.ErrNoRows {
		return 0, ErrUserNotFound
	}
	if err != nil {
		return 0, err
	}
	return userID, nil
}

// ResolveByCabinetDevice возвращает user_id для синтетического id из cabinetDeviceId.
func ResolveByCabinetDevice(ctx context.Context, syntheticID int64) (int64, error) {
	if !identity.IsSyntheticCabinetDeviceID(syntheticID) {
		return 0, fmt.Errorf("invalid synthetic id: %d", syntheticID)
	}
	var userID int64
	err := db.Pool.QueryRowContext(ctx, `
		SELECT id
		FROM users
		WHERE cabinet_device_user_id = $1 OR id = $1
		LIMIT 1;
	`, syntheticID).Scan(&userID)
	if err == nil {
		return userID, nil
	}
	if err != sql.ErrNoRows {
		return 0, err
	}
	if _, err := db.Pool.ExecContext(ctx, `
		INSERT INTO users (id, cabinet_device_user_id)
		VALUES ($1, $1)
		ON CONFLICT (id) DO UPDATE
		SET cabinet_device_user_id = COALESCE(users.cabinet_device_user_id, EXCLUDED.cabinet_device_user_id), updated_at = NOW();
	`, syntheticID); err != nil {
		return 0, err
	}
	return syntheticID, nil
}

// LinkEmailToUser привязывает подтверждённый email к user_id.
// Конфликт с другим user_id трактуется как ErrEmailAlreadyLinked.
func LinkEmailToUser(ctx context.Context, userID int64, email string) (int64, error) {
	emailNorm := emailverify.NormalizeEmail(email)
	if !emailverify.ValidateEmailFormat(emailNorm) {
		return 0, emailverify.ErrInvalidEmail
	}

	tx, err := db.Pool.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback() }()

	var ownerID int64
	err = tx.QueryRowContext(ctx, `
		SELECT id FROM users
		WHERE lower(trim(email::text)) = $1
		  AND email_verified_at IS NOT NULL
		LIMIT 1;
	`, emailNorm).Scan(&ownerID)
	if err != nil && err != sql.ErrNoRows {
		return 0, err
	}
	if err == nil && ownerID != userID {
		return 0, ErrEmailAlreadyLinked
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO users (id, email, email_verified_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (id) DO UPDATE
		SET
			email = EXCLUDED.email,
			email_verified_at = COALESCE(users.email_verified_at, NOW()),
			updated_at = NOW();
	`, userID, emailNorm); err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return userID, nil
}

// LinkTelegramToUser привязывает реальный telegram_id к user_id.
func LinkTelegramToUser(ctx context.Context, userID, telegramID int64) (int64, error) {
	if !identity.IsTelegramID(telegramID) {
		return 0, fmt.Errorf("invalid telegram id: %d", telegramID)
	}
	tx, err := db.Pool.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback() }()

	var ownerID int64
	err = tx.QueryRowContext(ctx, `SELECT id FROM users WHERE telegram_id = $1 LIMIT 1;`, telegramID).Scan(&ownerID)
	if err != nil && err != sql.ErrNoRows {
		return 0, err
	}
	if err == nil && ownerID != userID {
		return 0, ErrTelegramAlreadyUsed
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO users (id, telegram_id, updated_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE
		SET telegram_id = EXCLUDED.telegram_id, updated_at = EXCLUDED.updated_at;
	`, userID, telegramID, time.Now().UTC()); err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return userID, nil
}

func findUserByTelegram(ctx context.Context, telegramID int64) (int64, bool, error) {
	var userID int64
	err := db.Pool.QueryRowContext(ctx, `SELECT id FROM users WHERE telegram_id = $1 LIMIT 1;`, telegramID).Scan(&userID)
	if err == sql.ErrNoRows {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	return userID, true, nil
}
