package mainmenu

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"mime/multipart"
	"net/http"
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

	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	_ = w.WriteField("chat_id", strconv.FormatInt(chatID, 10))
	_ = w.WriteField("text", mainMenuText)
	_ = w.WriteField("reply_markup", string(markupJSON))
	_ = w.Close()

	req, err := http.NewRequest(http.MethodPost, "https://api.telegram.org/bot"+token+"/sendMessage", body)
	if err != nil {
		log.Printf("ERROR main menu request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "multipart/form-data; boundary="+w.Boundary())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("ERROR sending main menu: %v", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		log.Printf("ERROR sendMessage (main menu) response: %d %s", resp.StatusCode, string(b))
	}
}
