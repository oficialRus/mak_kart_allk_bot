package models

import (
	"encoding/json"
	"time"
)

type AIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type AISession struct {
	ID        int64           `db:"id"`
	UserID    int64           `db:"user_id"`
	Messages  json.RawMessage `db:"messages"`
	CreatedAt time.Time       `db:"created_at"`
	UpdatedAt time.Time       `db:"updated_at"`
}
