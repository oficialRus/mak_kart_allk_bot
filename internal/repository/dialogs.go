package repository

import (
	"context"
	"encoding/json"
	"time"

	"mak_kart_allk_bot/internal/db"
)

// DialogMessage описывает одно сообщение в сохранённом диалоге.
type DialogMessage struct {
	From string `json:"from"` // "user" или "ai"
	Text string `json:"text"`
}

// DialogSummary — короткая информация о разборе для списка.
type DialogSummary struct {
	ID        int64     `json:"id"`
	Mode      string    `json:"mode"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"createdAt"`
}

// DialogFull — полный разбор с историей сообщений.
type DialogFull struct {
	ID        int64           `json:"id"`
	Mode      string          `json:"mode"`
	Title     string          `json:"title"`
	CreatedAt time.Time       `json:"createdAt"`
	Messages  []DialogMessage `json:"messages"`
}

// SaveDialog сохраняет новый разбор.
func SaveDialog(ctx context.Context, telegramID int64, mode, title string, messages []DialogMessage) error {
	if title == "" && len(messages) > 0 {
		// Берём первые ~120 символов первого пользовательского сообщения.
		for _, m := range messages {
			if m.From == "user" && m.Text != "" {
				runes := []rune(m.Text)
				if len(runes) > 120 {
					title = string(runes[:120]) + "…"
				} else {
					title = m.Text
				}
				break
			}
		}
	}
	if title == "" {
		title = "Разбор без названия"
	}

	data, err := json.Marshal(messages)
	if err != nil {
		return err
	}

	const q = `
		INSERT INTO mini_app_dialogs (telegram_id, mode, title, messages)
		VALUES ($1, $2, $3, $4);
	`
	_, err = db.Pool.ExecContext(ctx, q, telegramID, mode, title, data)
	return err
}

// ListDialogs возвращает список разборов пользователя (новые сверху).
func ListDialogs(ctx context.Context, telegramID int64, limit int) ([]DialogSummary, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	const q = `
		SELECT id, mode, title, created_at
		FROM mini_app_dialogs
		WHERE telegram_id = $1
		ORDER BY created_at DESC
		LIMIT $2;
	`
	rows, err := db.Pool.QueryContext(ctx, q, telegramID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []DialogSummary
	for rows.Next() {
		var d DialogSummary
		if err := rows.Scan(&d.ID, &d.Mode, &d.Title, &d.CreatedAt); err != nil {
			return nil, err
		}
		res = append(res, d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return res, nil
}

// GetDialog возвращает сохранённый разбор по id и telegram_id.
func GetDialog(ctx context.Context, telegramID, id int64) (*DialogFull, error) {
	const q = `
		SELECT id, mode, title, created_at, messages
		FROM mini_app_dialogs
		WHERE telegram_id = $1 AND id = $2;
	`
	row := db.Pool.QueryRowContext(ctx, q, telegramID, id)

	var d DialogFull
	var raw json.RawMessage
	if err := row.Scan(&d.ID, &d.Mode, &d.Title, &d.CreatedAt, &raw); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(raw, &d.Messages); err != nil {
		return nil, err
	}
	return &d, nil
}

