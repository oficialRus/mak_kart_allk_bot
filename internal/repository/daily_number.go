package repository

import (
	"context"
	"database/sql"
	"math/rand"
	"time"

	"mak_kart_allk_bot/internal/db"
)

// GetOrCreateDailyNumber возвращает "цифру дня" для пользователя на указанную дату.
// Алгоритм:
//   1. Ищем запись (telegram_id, for_date) в mini_app_daily_numbers.
//   2. Если есть — возвращаем сохранённое значение.
//   3. Если нет — детерминированно генерируем число 1..9 и сохраняем.
func GetOrCreateDailyNumber(ctx context.Context, telegramID int64, day time.Time) (int, error) {
	// Нормализуем дату до UTC-дня без времени.
	forDate := day.UTC().Truncate(24 * time.Hour)

	const selectQuery = `
SELECT number
FROM mini_app_daily_numbers
WHERE telegram_id = $1 AND for_date = $2;
`
	var stored int
	err := db.Pool.QueryRowContext(ctx, selectQuery, telegramID, forDate).Scan(&stored)
	if err == nil {
		return stored, nil
	}
	if err != nil && err != sql.ErrNoRows {
		return 0, err
	}

	// Записи нет – детерминированно генерируем число из диапазона 1..9.
	// Используем комбинацию telegramID и даты как seed,
	// чтобы при одинаковых входных параметрах результат был стабильным.
	seed := telegramID ^ forDate.Unix()
	r := rand.New(rand.NewSource(seed))
	newNumber := r.Intn(9) + 1

	const insertQuery = `
INSERT INTO mini_app_daily_numbers (telegram_id, for_date, number)
VALUES ($1, $2, $3);
`
	if _, err := db.Pool.ExecContext(ctx, insertQuery, telegramID, forDate, newNumber); err != nil {
		return 0, err
	}

	return newNumber, nil
}

