package api

import (
	"encoding/json"
	"log"
	"net/http"

	"mak_kart_allk_bot/internal/repository"
	"mak_kart_allk_bot/internal/webapp"
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
}

// ProfileGetHandler обрабатывает POST /api/profile-get:
// проверяет initData, читает профиль из БД и возвращает его мини‑приложению.
func ProfileGetHandler(botToken string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req ProfileGetRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if req.InitData == "" {
			http.Error(w, "initData required", http.StatusBadRequest)
			return
		}

		telegramID, err := webapp.ValidateInitData(botToken, req.InitData)
		if err != nil {
			log.Printf("api profile-get: initData validation failed: %v (initData=%q)", err, req.InitData)
			http.Error(w, "invalid or expired init data", http.StatusUnauthorized)
			return
		}

		profile, err := repository.GetProfile(r.Context(), telegramID)
		if err != nil {
			log.Printf("api profile-get: db error for telegram_id=%d: %v", telegramID, err)
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
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			log.Printf("api profile-get: encode response failed: %v", err)
		}
	}
}

