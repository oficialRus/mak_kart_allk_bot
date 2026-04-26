package repository

import (
	"context"
	"regexp"
	"testing"
	"time"

	"mak_kart_allk_bot/internal/db"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestCabinetSessionLifecycle(t *testing.T) {
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer sqlDB.Close()
	db.Pool = sqlDB

	const (
		userID = int64(42)
		email  = "user@example.com"
		pepper = "pepper"
	)

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM cabinet_auth_sessions WHERE user_id = $1`)).
		WithArgs(userID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta(`
		INSERT INTO cabinet_auth_sessions (token_hash, user_id, email_normalized, expires_at)
		VALUES ($1, $2, $3, $4)
	`)).
		WithArgs(sqlmock.AnyArg(), userID, email, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	token, _, err := CreateCabinetSession(context.Background(), userID, email, pepper, 24*time.Hour)
	if err != nil {
		t.Fatalf("CreateCabinetSession: %v", err)
	}
	if token == "" {
		t.Fatal("expected token")
	}

	hash := hashCabinetSessionToken(pepper, token)
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT user_id FROM cabinet_auth_sessions WHERE token_hash = $1 AND expires_at > NOW() LIMIT 1;`)).
		WithArgs(hash).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}).AddRow(userID))

	uid, ok, err := ValidateCabinetSessionToken(context.Background(), token, pepper)
	if err != nil {
		t.Fatalf("ValidateCabinetSessionToken: %v", err)
	}
	if !ok || uid != userID {
		t.Fatalf("unexpected validate result ok=%v uid=%d", ok, uid)
	}

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM cabinet_auth_sessions WHERE token_hash = $1`)).
		WithArgs(hash).
		WillReturnResult(sqlmock.NewResult(0, 1))
	if err := RevokeCabinetSessionByToken(context.Background(), token, pepper); err != nil {
		t.Fatalf("RevokeCabinetSessionByToken: %v", err)
	}

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM cabinet_auth_sessions WHERE user_id = $1`)).
		WithArgs(userID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	if err := RevokeAllCabinetSessionsForUser(context.Background(), userID); err != nil {
		t.Fatalf("RevokeAllCabinetSessionsForUser: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}
