package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"mak_kart_allk_bot/internal/db"
)

// CardDayCard описывает карту из таблицы card_day_cards.
type CardDayCard struct {
	ID          int
	ImagePath   string
	Title       string
	Description string
	IsActive    bool
	CreatedAt   time.Time
}

var msk = time.FixedZone("MSK", 3*60*60)

// todayMSK возвращает сегодняшнюю дату по Москве (UTC+3) как UTC-дату без времени.
func todayMSK() time.Time {
	now := time.Now().In(msk)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

// GetOrAssignCardOfDay — основная точка входа для получения карты дня.
// Если пользователю уже назначена карта на сегодня — возвращает её.
// Иначе выбирает случайную из активных, исключая показанные за последние exclusionDays дней.
// Если все карты были показаны — ослабляет ограничение и выбирает из всех активных.
func GetOrAssignCardOfDay(ctx context.Context, userID int64, exclusionDays int) (*CardDayCard, error) {
	today := todayMSK()

	card, err := getTodayCard(ctx, userID, today)
	if err != nil {
		return nil, fmt.Errorf("getTodayCard: %w", err)
	}
	if card != nil {
		return card, nil
	}

	recentIDs, err := getRecentCardIDs(ctx, userID, today, exclusionDays)
	if err != nil {
		return nil, fmt.Errorf("getRecentCardIDs: %w", err)
	}

	card, err = pickRandomCard(ctx, recentIDs)
	if err != nil {
		return nil, fmt.Errorf("pickRandomCard: %w", err)
	}

	// Если все карты были показаны недавно — выбираем из всех активных (fallback).
	if card == nil {
		card, err = pickRandomCard(ctx, nil)
		if err != nil {
			return nil, fmt.Errorf("pickRandomCard (fallback): %w", err)
		}
	}

	if card == nil {
		return nil, nil
	}

	if err := saveAssignment(ctx, userID, card.ID, today); err != nil {
		return nil, fmt.Errorf("saveAssignment: %w", err)
	}

	return card, nil
}

// getTodayCard проверяет, есть ли уже назначенная карта на сегодня.
func getTodayCard(ctx context.Context, userID int64, today time.Time) (*CardDayCard, error) {
	q := `
	SELECT c.id, c.image_path, c.title, c.description, c.is_active, c.created_at
	FROM card_day_history h
	JOIN card_day_cards c ON c.id = h.card_id
	WHERE h.user_id = $1 AND h.assigned_date = $2;`

	var c CardDayCard
	err := db.Pool.QueryRowContext(ctx, q, userID, today).Scan(
		&c.ID, &c.ImagePath, &c.Title, &c.Description, &c.IsActive, &c.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// getRecentCardIDs возвращает ID карт, показанных пользователю за последние days дней.
func getRecentCardIDs(ctx context.Context, userID int64, today time.Time, days int) ([]int, error) {
	since := today.AddDate(0, 0, -days)

	q := `SELECT card_id FROM card_day_history
	      WHERE user_id = $1 AND assigned_date >= $2 AND assigned_date < $3;`

	rows, err := db.Pool.QueryContext(ctx, q, userID, since, today)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// pickRandomCard выбирает случайную активную карту, исключая указанные ID.
func pickRandomCard(ctx context.Context, excludeIDs []int) (*CardDayCard, error) {
	var q string
	var args []interface{}

	if len(excludeIDs) == 0 {
		q = `SELECT id, image_path, title, description, is_active, created_at
		     FROM card_day_cards WHERE is_active = TRUE
		     ORDER BY RANDOM() LIMIT 1;`
	} else {
		placeholders := ""
		for i, id := range excludeIDs {
			if i > 0 {
				placeholders += ","
			}
			placeholders += fmt.Sprintf("$%d", i+1)
			args = append(args, id)
		}
		q = fmt.Sprintf(`SELECT id, image_path, title, description, is_active, created_at
		     FROM card_day_cards WHERE is_active = TRUE AND id NOT IN (%s)
		     ORDER BY RANDOM() LIMIT 1;`, placeholders)
	}

	var c CardDayCard
	err := db.Pool.QueryRowContext(ctx, q, args...).Scan(
		&c.ID, &c.ImagePath, &c.Title, &c.Description, &c.IsActive, &c.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// saveAssignment сохраняет запись о выдаче карты пользователю.
func saveAssignment(ctx context.Context, userID int64, cardID int, today time.Time) error {
	q := `INSERT INTO card_day_history (user_id, card_id, assigned_date)
	      VALUES ($1, $2, $3)
	      ON CONFLICT (user_id, assigned_date) DO NOTHING;`
	_, err := db.Pool.ExecContext(ctx, q, userID, cardID, today)
	return err
}

// CreateCardDayCard добавляет новую карту в базу.
func CreateCardDayCard(ctx context.Context, imagePath, title, description string) (int, error) {
	q := `INSERT INTO card_day_cards (image_path, title, description)
	      VALUES ($1, $2, $3) RETURNING id;`
	var id int
	err := db.Pool.QueryRowContext(ctx, q, imagePath, title, description).Scan(&id)
	return id, err
}

// CountActiveCards возвращает количество активных карт.
func CountActiveCards(ctx context.Context) (int, error) {
	var count int
	err := db.Pool.QueryRowContext(ctx, `SELECT COUNT(*) FROM card_day_cards WHERE is_active = TRUE;`).Scan(&count)
	return count, err
}

// ListCardDayCards возвращает все карты (для админского просмотра).
func ListCardDayCards(ctx context.Context) ([]CardDayCard, error) {
	q := `SELECT id, image_path, title, description, is_active, created_at
	      FROM card_day_cards ORDER BY id;`
	rows, err := db.Pool.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cards []CardDayCard
	for rows.Next() {
		var c CardDayCard
		if err := rows.Scan(&c.ID, &c.ImagePath, &c.Title, &c.Description, &c.IsActive, &c.CreatedAt); err != nil {
			return nil, err
		}
		cards = append(cards, c)
	}
	return cards, rows.Err()
}

// ToggleCardActive переключает статус is_active карты.
func ToggleCardActive(ctx context.Context, cardID int) error {
	q := `UPDATE card_day_cards SET is_active = NOT is_active WHERE id = $1;`
	_, err := db.Pool.ExecContext(ctx, q, cardID)
	return err
}
