// Регистрирует файлы из data/cards в таблице card_day_cards (если ещё нет такого имени файла).
// Случайная «карта дня» берётся только из активных строк БД; лежащий на диске файл без строки в БД не участвует.
//
// Запуск из корня проекта (нужны DB_* в окружении, как у бота):
//
//	go run ./cmd/register-card-day-files
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"mak_kart_allk_bot/internal/db"
	"mak_kart_allk_bot/internal/repository"
)

func main() {
	log.SetFlags(0)
	if err := db.InitFromEnv(); err != nil {
		log.Fatal(err)
	}
	defer db.Pool.Close()

	dir := filepath.Join("data", "cards")
	if len(os.Args) > 1 {
		dir = os.Args[1]
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		log.Fatalf("read dir %s: %v", dir, err)
	}

	ctx := context.Background()
	existing, err := loadExistingBasenames(ctx)
	if err != nil {
		log.Fatal(err)
	}

	var added int
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if strings.HasPrefix(strings.ToLower(name), "start_welcome") {
			continue
		}
		if !looksLikeImage(name) {
			continue
		}
		base := filepath.Base(name)
		if existing[base] {
			continue
		}
		rel := filepath.Join(dir, name)
		if _, err := repository.CreateCardDayCard(ctx, rel, "", ""); err != nil {
			log.Printf("skip %s: %v", rel, err)
			continue
		}
		existing[base] = true
		added++
		fmt.Println("+", rel)
	}
	fmt.Printf("Готово: добавлено новых карт в БД: %d (папка %s)\n", added, dir)
}

func looksLikeImage(name string) bool {
	n := strings.ToLower(name)
	return strings.HasSuffix(n, ".jpg") ||
		strings.HasSuffix(n, ".jpeg") ||
		strings.HasSuffix(n, ".png") ||
		strings.HasSuffix(n, ".webp")
}

func loadExistingBasenames(ctx context.Context) (map[string]bool, error) {
	rows, err := db.Pool.QueryContext(ctx, `SELECT image_path FROM card_day_cards`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := make(map[string]bool)
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		m[filepath.Base(strings.TrimSpace(p))] = true
	}
	return m, rows.Err()
}
