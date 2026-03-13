package card_day

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"mak_kart_allk_bot/internal/repository"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

const cardStorageDir = "data/cards"

// HandleAdminUpload обрабатывает загрузку новой карты от администратора через Telegram.
// Администратор отправляет фото с подписью вида: /upload_card Название карты
// Бот скачивает изображение, сохраняет на диск и создаёт запись в БД.
func HandleAdminUpload(bot *tgbotapi.BotAPI, chatID int64, token string, photos []tgbotapi.PhotoSize, caption string) {
	title := strings.TrimSpace(strings.TrimPrefix(caption, "/upload_card"))

	photo := photos[len(photos)-1]

	fileConfig := tgbotapi.FileConfig{FileID: photo.FileID}
	file, err := bot.GetFile(fileConfig)
	if err != nil {
		log.Printf("ERROR admin upload: getFile: %v", err)
		bot.Send(tgbotapi.NewMessage(chatID, "Ошибка получения файла: "+err.Error()))
		return
	}

	fileURL := file.Link(token)
	resp, err := http.Get(fileURL)
	if err != nil {
		log.Printf("ERROR admin upload: download %s: %v", fileURL, err)
		bot.Send(tgbotapi.NewMessage(chatID, "Ошибка скачивания файла."))
		return
	}
	defer resp.Body.Close()

	if err := os.MkdirAll(cardStorageDir, 0755); err != nil {
		log.Printf("ERROR admin upload: mkdir %s: %v", cardStorageDir, err)
		bot.Send(tgbotapi.NewMessage(chatID, "Ошибка создания директории хранилища."))
		return
	}

	ext := filepath.Ext(file.FilePath)
	if ext == "" {
		ext = ".jpg"
	}
	filename := fmt.Sprintf("card_%d%s", time.Now().UnixNano(), ext)
	savePath := filepath.Join(cardStorageDir, filename)

	dst, err := os.Create(savePath)
	if err != nil {
		log.Printf("ERROR admin upload: create file %s: %v", savePath, err)
		bot.Send(tgbotapi.NewMessage(chatID, "Ошибка сохранения файла."))
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, resp.Body); err != nil {
		log.Printf("ERROR admin upload: write file: %v", err)
		bot.Send(tgbotapi.NewMessage(chatID, "Ошибка записи файла."))
		return
	}

	ctx := context.Background()
	id, err := repository.CreateCardDayCard(ctx, savePath, title, "")
	if err != nil {
		log.Printf("ERROR admin upload: create card in DB: %v", err)
		bot.Send(tgbotapi.NewMessage(chatID, "Ошибка сохранения карты в базу данных."))
		return
	}

	total, _ := repository.CountActiveCards(ctx)

	text := fmt.Sprintf("✅ Карта добавлена!\n\nID: %d\nНазвание: %s\nФайл: %s\n\nВсего активных карт: %d",
		id, title, filename, total)
	bot.Send(tgbotapi.NewMessage(chatID, text))

	log.Printf("Admin uploaded card id=%d title=%q path=%s", id, title, savePath)
}

// IsAdminUploadCaption проверяет, является ли подпись к фото командой загрузки карты.
func IsAdminUploadCaption(caption string) bool {
	return strings.HasPrefix(strings.TrimSpace(caption), "/upload_card")
}
