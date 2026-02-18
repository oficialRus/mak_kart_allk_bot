package services

import "mak_kart_bot/internal/models"

// QuizResult — результат, который приходит из Mini App.
type QuizResult struct {
	Answers map[string]int `json:"answers"` // question_id -> score (0-2)
	Skipped bool           `json:"skipped"`
}

// DetermineLevel рассчитывает уровень пользователя по сумме баллов.
//
// Каждый ответ оценивается от 0 до 2:
//   0 — нет опыта / не знаю
//   1 — слышал, базовое понимание
//   2 — знаю хорошо / практикую
//
// Итог:
//   0–33%  → Новичок
//   34–66% → Средний
//   67–100% → Профи
func DetermineLevel(result QuizResult, maxScore int) models.UserLevel {
	if result.Skipped || maxScore == 0 {
		return models.LevelBeginner
	}

	total := 0
	for _, score := range result.Answers {
		total += score
	}

	percent := float64(total) / float64(maxScore) * 100

	switch {
	case percent >= 67:
		return models.LevelPro
	case percent >= 34:
		return models.LevelMiddle
	default:
		return models.LevelBeginner
	}
}
