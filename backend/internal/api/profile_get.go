package api

import (
	"encoding/json"
	"log"
	"net/http"

	"mak_kart_allk_bot/internal/repository"
)

// ProfileGetRequest — тело POST /api/profile-get от мини‑приложения.
type ProfileGetRequest struct {
	InitData string `json:"initData"`
}

// ProfileGetResponse — ответ с данными профиля для мини‑приложения.
type ProfileGetResponse struct {
	FullName       string `json:"fullName"`
	BirthDate      string `json:"birthDate"`
	Phone          string `json:"phone"`
	LearningLevel  string `json:"learningLevel"`
	LearningGoal   string `json:"learningGoal"`
	LearningFormat string `json:"learningFormat"`
	Email          string `json:"email"`
	EmailVerified  bool   `json:"emailVerified"`
}

// ProfileGetHandler обрабатывает POST /api/profile-get:
// проверяет initData, читает профиль из БД и возвращает его мини‑приложению.
func ProfileGetHandler(botToken string) http.HandlerFunc {
	return withSessionOrInitData(botToken, func(w http.ResponseWriter, r *http.Request, userID int64) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req ProfileGetRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		profile, err := repository.GetProfile(r.Context(), userID)
		if err != nil {
			log.Printf("api profile-get: db error for user_id=%d: %v", userID, err)
			http.Error(w, "failed to load profile", http.StatusInternalServerError)
			return
		}
		if profile == nil {
			http.Error(w, "profile not found", http.StatusNotFound)
			return
		}

		resp := ProfileGetResponse{
			FullName:       profile.FullName,
			BirthDate:      profile.BirthDate,
			Phone:          profile.Phone,
			LearningLevel:  profile.LearningLevel,
			LearningGoal:   profile.LearningGoal,
			LearningFormat: profile.LearningFormat,
			Email:          profile.Email,
			EmailVerified:  profile.EmailVerifiedAt != nil && profile.Email != "",
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			log.Printf("api profile-get: encode response failed: %v", err)
		}
	})
}

