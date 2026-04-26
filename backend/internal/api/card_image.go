package api

import (
	"log"
	"net/http"
	"path/filepath"
)

// CardImageHandler отдаёт файл карты из директории data/cards по имени файла.
// Используется как /api/card-image?name=...
func CardImageHandler() http.HandlerFunc {
	const cardsDir = "data/cards"

	return func(w http.ResponseWriter, r *http.Request) {
		name := r.URL.Query().Get("name")
		if name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
			return
		}

		// Безопасность: берём только basename, чтобы нельзя было вылезти из директории.
		cleanName := filepath.Base(name)
		if cleanName == "." || cleanName == "/" {
			http.Error(w, "invalid name", http.StatusBadRequest)
			return
		}

		fullPath := filepath.Join(cardsDir, cleanName)

		// Отдаём файл напрямую. Статус/ошибки «на совести» ServeFile.
		http.ServeFile(w, r, fullPath)
		log.Printf("card-image: served %s", fullPath)
	}
}

