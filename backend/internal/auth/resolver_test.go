package auth

import (
	"context"
	"errors"
	"regexp"
	"testing"

	"mak_kart_allk_bot/internal/db"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestResolveByTelegramFound(t *testing.T) {
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer sqlDB.Close()
	db.Pool = sqlDB

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id FROM users WHERE telegram_id = $1 LIMIT 1;`)).
		WithArgs(int64(12345)).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(12345)))

	userID, err := ResolveByTelegram(context.Background(), 12345)
	if err != nil {
		t.Fatalf("ResolveByTelegram: %v", err)
	}
	if userID != 12345 {
		t.Fatalf("unexpected user id: %d", userID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestResolveByEmailNotFound(t *testing.T) {
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer sqlDB.Close()
	db.Pool = sqlDB

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id
		FROM users
		WHERE lower(trim(email::text)) = $1
		  AND email_verified_at IS NOT NULL
		LIMIT 1;
	`)).
		WithArgs("none@example.com").
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT telegram_id
		FROM mini_app_profiles
		WHERE lower(trim(email)) = $1
		  AND email_verified_at IS NOT NULL
		  AND trim(email) <> ''
		LIMIT 1;
	`)).
		WithArgs("none@example.com").
		WillReturnRows(sqlmock.NewRows([]string{"telegram_id"}))

	_, err = ResolveByEmail(context.Background(), "none@example.com")
	if !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("expected ErrUserNotFound, got: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestResolveByEmailLegacyFallback(t *testing.T) {
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer sqlDB.Close()
	db.Pool = sqlDB

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id
		FROM users
		WHERE lower(trim(email::text)) = $1
		  AND email_verified_at IS NOT NULL
		LIMIT 1;
	`)).
		WithArgs("legacy@example.com").
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT telegram_id
		FROM mini_app_profiles
		WHERE lower(trim(email)) = $1
		  AND email_verified_at IS NOT NULL
		  AND trim(email) <> ''
		LIMIT 1;
	`)).
		WithArgs("legacy@example.com").
		WillReturnRows(sqlmock.NewRows([]string{"telegram_id"}).AddRow(int64(-900000000001)))

	userID, err := ResolveByEmail(context.Background(), "legacy@example.com")
	if err != nil {
		t.Fatalf("ResolveByEmail legacy fallback: %v", err)
	}
	if userID != -900000000001 {
		t.Fatalf("unexpected user id: %d", userID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestLinkEmailToUserConflict(t *testing.T) {
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer sqlDB.Close()
	db.Pool = sqlDB

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id FROM users
		WHERE lower(trim(email::text)) = $1
		  AND email_verified_at IS NOT NULL
		LIMIT 1;
	`)).
		WithArgs("taken@example.com").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(999)))
	mock.ExpectRollback()

	_, err = LinkEmailToUser(context.Background(), 100, "taken@example.com")
	if !errors.Is(err, ErrEmailAlreadyLinked) {
		t.Fatalf("expected ErrEmailAlreadyLinked, got: %v", err)
	}
}
