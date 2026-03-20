package api

import (
	"encoding/json"
	"log"
	"net/http"

	"mak_kart_allk_bot/internal/repository"
	"mak_kart_allk_bot/internal/webapp"
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
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req ProfileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if req.FullName == "" || req.BirthDate == "" {
			http.Error(w, "fullName and birthDate required", http.StatusBadRequest)
			return
		}

		log.Printf("api profile: received fullName=%q birthDate=%q initData_len=%d", req.FullName, req.BirthDate, len(req.InitData))

		telegramID, err := webapp.ValidateInitData(botToken, req.InitData)
		if err != nil {
			log.Printf("api profile: initData validation failed: %v (initData=%q)", err, req.InitData)
			http.Error(w, "invalid or expired init data", http.StatusUnauthorized)
			return
		}

		if err := repository.SaveProfile(
			r.Context(),
			telegramID,
			req.FullName,
			req.BirthDate,
			"",
			req.LearningLevel,
			req.LearningGoal,
			req.LearningFormat,
		); err != nil {
			log.Printf("api profile: save failed for telegram_id=%d: %v", telegramID, err)
			http.Error(w, "failed to save profile", http.StatusInternalServerError)
			return
		}

		log.Printf("api profile: saved OK telegram_id=%d fullName=%q birthDate=%q", telegramID, req.FullName, req.BirthDate)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"ok": true})
	}
}
