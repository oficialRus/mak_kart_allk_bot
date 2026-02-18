package models

import (
	"encoding/json"
	"time"
)

type UserLevel string

const (
	LevelBeginner UserLevel = "beginner"
	LevelMiddle   UserLevel = "middle"
	LevelPro      UserLevel = "pro"
)

type User struct {
	ID          int64           `db:"id"`
	TelegramID  int64           `db:"telegram_id"`
	Username    string          `db:"username"`
	FullName    string          `db:"full_name"`
	Level       UserLevel       `db:"level"`
	QuizAnswers json.RawMessage `db:"quiz_answers"`
	QuizSkipped bool            `db:"quiz_skipped"`
	CreatedAt   time.Time       `db:"created_at"`
	UpdatedAt   time.Time       `db:"updated_at"`
}
