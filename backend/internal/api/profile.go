package api

import (
	"encoding/json"
	"log"
	"net/http"

	"mak_kart_allk_bot/internal/repository"
)

// ProfileRequest — тело POST /api/profile от мини‑приложения.
type ProfileRequest struct {
	InitData       string `json:"initData"`
	FullName       string `json:"fullName"`
	BirthDate      string `json:"birthDate"`
	LearningLevel  string `json:"learningLevel"`
	LearningGoal   string `json:"learningGoal"`
	LearningFormat string `json:"learningFormat"`
}

// ProfileHandler обрабатывает POST /api/profile: проверяет initData и сохраняет профиль в БД.
func ProfileHandler(botToken string) http.HandlerFunc {
	return withSessionOrInitData(botToken, func(w http.ResponseWriter, r *http.Request, userID int64) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req ProfileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		log.Printf("api profile: received fullName=%q birthDate=%q", req.FullName, req.BirthDate)

		if err := repository.SaveProfile(
			r.Context(),
			userID,
			req.FullName,
			req.BirthDate,
			"",
			req.LearningLevel,
			req.LearningGoal,
			req.LearningFormat,
		); err != nil {
			log.Printf("api profile: save failed for user_id=%d: %v", userID, err)
			http.Error(w, "failed to save profile", http.StatusInternalServerError)
			return
		}

		log.Printf("api profile: saved OK user_id=%d fullName=%q birthDate=%q", userID, req.FullName, req.BirthDate)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"ok": true})
	})
}
