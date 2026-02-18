package models

import (
	"encoding/json"
	"time"
)

type EducationProgress struct {
	ID               int64           `db:"id"`
	UserID           int64           `db:"user_id"`
	CourseID         string          `db:"course_id"`
	CompletedLessons json.RawMessage `db:"completed_lessons"`
	UpdatedAt        time.Time       `db:"updated_at"`
}
