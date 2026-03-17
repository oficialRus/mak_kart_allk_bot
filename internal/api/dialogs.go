package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"mak_kart_allk_bot/internal/repository"
	"mak_kart_allk_bot/internal/webapp"
)

type dialogSaveRequest struct {
	InitData string                    `json:"initData"`
	Mode     string                    `json:"mode"`
	Title    string                    `json:"title"`
	Messages []repository.DialogMessage `json:"messages"`
}

// DialogSaveHandler — POST /api/dialog-save
// Сохраняет разбор/диалог мини‑приложения в БД.
func DialogSaveHandler(botToken string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req dialogSaveRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}
		if req.InitData == "" {
			http.Error(w, "initData is required", http.StatusBadRequest)
			return
		}
		if len(req.Messages) == 0 {
			http.Error(w, "messages are required", http.StatusBadRequest)
			return
		}
		if req.Mode == "" {
			req.Mode = "dialog"
		}

		telegramID, err := webapp.ValidateInitData(botToken, req.InitData)
		if err != nil {
			log.Printf("api dialog-save: initData validation failed: %v", err)
			http.Error(w, "invalid or expired init data", http.StatusUnauthorized)
			return
		}

		if err := repository.SaveDialog(r.Context(), telegramID, req.Mode, req.Title, req.Messages); err != nil {
			log.Printf("api dialog-save: save failed for telegram_id=%d: %v", telegramID, err)
			http.Error(w, "failed to save dialog", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}
}

type dialogsListRequest struct {
	InitData string `json:"initData"`
	Limit    int    `json:"limit"`
}

// DialogsListHandler — POST /api/dialogs
// Возвращает список сохранённых разборов пользователя.
func DialogsListHandler(botToken string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req dialogsListRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}
		if req.InitData == "" {
			http.Error(w, "initData is required", http.StatusBadRequest)
			return
		}

		telegramID, err := webapp.ValidateInitData(botToken, req.InitData)
		if err != nil {
			log.Printf("api dialogs: initData validation failed: %v", err)
			http.Error(w, "invalid or expired init data", http.StatusUnauthorized)
			return
		}

		dialogs, err := repository.ListDialogs(r.Context(), telegramID, req.Limit)
		if err != nil {
			log.Printf("api dialogs: list failed for telegram_id=%d: %v", telegramID, err)
			http.Error(w, "failed to list dialogs", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(dialogs)
	}
}

// DialogGetHandler — GET /api/dialog?id=...
// Возвращает полный разбор по id (если он принадлежит пользователю).
func DialogGetHandler(botToken string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		initData := r.URL.Query().Get("initData")
		if initData == "" {
			http.Error(w, "initData is required", http.StatusBadRequest)
			return
		}
		idStr := r.URL.Query().Get("id")
		if idStr == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil || id <= 0 {
			http.Error(w, "invalid id", http.StatusBadRequest)
			return
		}

		telegramID, err := webapp.ValidateInitData(botToken, initData)
		if err != nil {
			log.Printf("api dialog-get: initData validation failed: %v", err)
			http.Error(w, "invalid or expired init data", http.StatusUnauthorized)
			return
		}

		dialog, err := repository.GetDialog(r.Context(), telegramID, id)
		if err != nil {
			log.Printf("api dialog-get: get failed for telegram_id=%d id=%d: %v", telegramID, id, err)
			http.Error(w, "failed to load dialog", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(dialog)
	}
}

