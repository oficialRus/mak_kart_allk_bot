package mainmenu

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

const mainMenuText = "Главное меню. Выберите раздел:"

// Handle рисует главное меню (текст + кнопки, без картинки-заглушки).
func Handle(bot *tgbotapi.BotAPI, chatID int64, miniappURL, token string) {
	buttonURL := miniappURL
	if strings.Contains(miniappURL, "localhost") {
		buttonURL = "https://example.com"
	}

	replyMarkup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{{"text": "🤖 ИИ-психолог Коуч", "callback_data": "main_menu_ai"}},
			{{"text": "🔢 Цифра дня", "web_app": map[string]string{"url": buttonURL}}},
			{
				{"text": "📚 Обучение", "callback_data": "main_menu_education"},
				{"text": "📇 Контакты", "callback_data": "main_menu_contacts"},
			},
			{
				{"text": "🛒 Магазин", "callback_data": "main_menu_shop"},
				{"text": "👤 Личный кабинет", "callback_data": "main_menu_cabinet"},
			},
		},
	}
	markupJSON, _ := json.Marshal(replyMarkup)

	// Пытаемся отправить картинку главного меню как фото с подписью и кнопками.
	// Все картинки храним в cmd/bot/images.
	imagePath := filepath.Join("cmd", "bot", "images", "main_menu.png")
	if f, err := os.Open(imagePath); err == nil {
		defer f.Close()

		body := &bytes.Buffer{}
		w := multipart.NewWriter(body)
		_ = w.WriteField("chat_id", strconv.FormatInt(chatID, 10))
		part, _ := w.CreateFormFile("photo", filepath.Base(imagePath))
		_, _ = io.Copy(part, f)
		_ = w.WriteField("caption", mainMenuText)
		_ = w.WriteField("reply_markup", string(markupJSON))
		_ = w.Close()

		req, err := http.NewRequest(http.MethodPost, "https://api.telegram.org/bot"+token+"/sendPhoto", body)
		if err != nil {
			log.Printf("ERROR main menu sendPhoto request: %v", err)
			return
		}
		req.Header.Set("Content-Type", "multipart/form-data; boundary="+w.Boundary())

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Printf("ERROR sending main menu photo: %v", err)
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			return
		}
		b, _ := io.ReadAll(resp.Body)
		log.Printf("ERROR sendPhoto (main menu) response: %d %s", resp.StatusCode, string(b))
	}

	// Если картинки нет или произошла ошибка — отправляем только текст и кнопки (как раньше).
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	_ = w.WriteField("chat_id", strconv.FormatInt(chatID, 10))
	_ = w.WriteField("text", mainMenuText)
	_ = w.WriteField("reply_markup", string(markupJSON))
	_ = w.Close()

	req, err := http.NewRequest(http.MethodPost, "https://api.telegram.org/bot"+token+"/sendMessage", body)
	if err != nil {
		log.Printf("ERROR main menu sendMessage request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "multipart/form-data; boundary="+w.Boundary())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("ERROR sending main menu text: %v", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		log.Printf("ERROR sendMessage (main menu fallback) response: %d %s", resp.StatusCode, string(b))
	}
}
