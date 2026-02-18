package middleware

import (
	"context"
	"log"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"mak_kart_bot/internal/models"
	"mak_kart_bot/internal/repository"
)

type UserMiddleware struct {
	repo *repository.UserRepository
}

func NewUserMiddleware(repo *repository.UserRepository) *UserMiddleware {
	return &UserMiddleware{repo: repo}
}

// EnsureUser создаёт пользователя в БД, если он ещё не существует.
func (m *UserMiddleware) EnsureUser(ctx context.Context, from *tgbotapi.User) {
	if from == nil {
		return
	}
	user := &models.User{
		TelegramID: from.ID,
		Username:   from.UserName,
		FullName:   from.FirstName + " " + from.LastName,
		Level:      models.LevelBeginner,
	}
	if err := m.repo.Create(ctx, user); err != nil {
		log.Printf("middleware: ensure user: %v", err)
	}
}
