package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"mak_kart_allk_bot/internal/repository"
)

const cardStorageDir = "data/cards"

// AdminUploadCardHandler — HTTP-эндпоинт для загрузки карт дня через API.
//
// POST /api/admin/upload-card
// Headers: X-Admin-Secret: <значение ADMIN_SECRET из .env>
// Body: multipart/form-data с полями image (файл), title (опционально), description (опционально)
//
// Пример curl:
//
//	curl -X POST http://localhost:8081/api/admin/upload-card \
//	  -H "X-Admin-Secret: your_secret" \
//	  -F "image=@card.jpg" \
//	  -F "title=Название карты"
func AdminUploadCardHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		secret := os.Getenv("ADMIN_SECRET")
		if secret == "" || r.Header.Get("X-Admin-Secret") != secret {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		if err := r.ParseMultipartForm(10 << 20); err != nil {
			http.Error(w, "bad request: "+err.Error(), http.StatusBadRequest)
			return
		}

		file, header, err := r.FormFile("image")
		if err != nil {
			http.Error(w, "image field required", http.StatusBadRequest)
			return
		}
		defer file.Close()

		title := r.FormValue("title")
		description := r.FormValue("description")

		if err := os.MkdirAll(cardStorageDir, 0755); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			log.Printf("ERROR admin upload API: mkdir %s: %v", cardStorageDir, err)
			return
		}

		ext := filepath.Ext(header.Filename)
		if ext == "" {
			ext = ".jpg"
		}
		filename := fmt.Sprintf("card_%d%s", time.Now().UnixNano(), ext)
		savePath := filepath.Join(cardStorageDir, filename)

		dst, err := os.Create(savePath)
		if err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			log.Printf("ERROR admin upload API: create file %s: %v", savePath, err)
			return
		}
		defer dst.Close()

		if _, err := io.Copy(dst, file); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			log.Printf("ERROR admin upload API: write file: %v", err)
			return
		}

		id, err := repository.CreateCardDayCard(context.Background(), savePath, title, description)
		if err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			log.Printf("ERROR admin upload API: create card in DB: %v", err)
			return
		}

		log.Printf("Admin API: uploaded card id=%d title=%q path=%s", id, title, savePath)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":          id,
			"image_path":  savePath,
			"title":       title,
			"description": description,
		})
	}
}

// AdminListCardsHandler — HTTP-эндпоинт для получения списка всех карт дня.
//
// GET /api/admin/cards
// Headers: X-Admin-Secret: <значение ADMIN_SECRET из .env>
func AdminListCardsHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		secret := os.Getenv("ADMIN_SECRET")
		if secret == "" || r.Header.Get("X-Admin-Secret") != secret {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		cards, err := repository.ListCardDayCards(context.Background())
		if err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			log.Printf("ERROR admin list cards API: %v", err)
			return
		}

		type cardResponse struct {
			ID          int    `json:"id"`
			ImagePath   string `json:"image_path"`
			Title       string `json:"title"`
			Description string `json:"description"`
			IsActive    bool   `json:"is_active"`
		}

		resp := make([]cardResponse, 0, len(cards))
		for _, c := range cards {
			resp = append(resp, cardResponse{
				ID:          c.ID,
				ImagePath:   c.ImagePath,
				Title:       c.Title,
				Description: c.Description,
				IsActive:    c.IsActive,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
