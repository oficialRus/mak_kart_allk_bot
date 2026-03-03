package cabinet

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

const (
	cabinetPlaceholderURL = "https://placehold.co/600x400/2c5282/eee/png?text=Личный+кабинет"
	cabinetCaption       = "Личный кабинет — для доступа к персональным материалам и настройкам пройдите регистрацию."
)

type regState struct {
	Step      int
	Phone     string
	FIO       string
	BirthDate string
}

var (
	regMu    sync.Mutex
	regStateByChat = make(map[int64]*regState)
)

// Handle обрабатывает нажатие на кнопку «Личный кабинет»: фото-заглушка и кнопка «Пройти регистрацию».
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	photo := tgbotapi.NewPhoto(chatID, tgbotapi.FileURL(cabinetPlaceholderURL))
	photo.Caption = cabinetCaption
	photo.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Пройти регистрацию", "cabinet_register"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Назад", "ai_coach_main_menu"),
		),
	)
	if _, err := bot.Send(photo); err != nil {
		log.Printf("ERROR sending cabinet message: %v", err)
	}
}

// StartRegistration запускает пошаговую регистрацию: шаг 1 — номер телефона.
func StartRegistration(bot *tgbotapi.BotAPI, chatID int64) {
	regMu.Lock()
	regStateByChat[chatID] = &regState{Step: 1}
	regMu.Unlock()

	msg := tgbotapi.NewMessage(chatID, "Шаг 1 из 3. Отправьте номер телефона (нажмите кнопку ниже или напишите в чат):")
	keyboard := tgbotapi.NewReplyKeyboard(
		tgbotapi.NewKeyboardButtonRow(
			tgbotapi.NewKeyboardButtonContact("Отправить номер телефона"),
		),
	)
	keyboard.OneTimeKeyboard = true
	msg.ReplyMarkup = keyboard
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending registration step 1: %v", err)
	}
}

// HandleRegistrationMessage обрабатывает ответ пользователя в процессе регистрации.
// Возвращает true, если сообщение обработано (чат в процессе регистрации).
func HandleRegistrationMessage(bot *tgbotapi.BotAPI, chatID int64, message *tgbotapi.Message) bool {
	regMu.Lock()
	state, ok := regStateByChat[chatID]
	regMu.Unlock()
	if !ok || state == nil {
		return false
	}

	switch state.Step {
	case 1:
		var phone string
		if message.Contact != nil {
			phone = message.Contact.PhoneNumber
		} else if message.Text != "" {
			phone = strings.TrimSpace(message.Text)
		}
		if phone == "" {
			_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Пожалуйста, отправьте номер телефона или нажмите кнопку «Отправить номер телефона»."))
			return true
		}
		state.Phone = phone
		state.Step = 2
		removeMsg := tgbotapi.NewMessage(chatID, "Шаг 2 из 3. Напишите ваше ФИО (фамилия, имя, отчество):")
		removeMsg.ReplyMarkup = tgbotapi.NewRemoveKeyboard(true)
		if _, err := bot.Send(removeMsg); err != nil {
			log.Printf("ERROR sending registration step 2 prompt: %v", err)
		}
		return true

	case 2:
		fio := strings.TrimSpace(message.Text)
		if fio == "" {
			_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Пожалуйста, напишите ваше ФИО текстом."))
			return true
		}
		state.FIO = fio
		state.Step = 3
		_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Шаг 3 из 3. Напишите вашу дату рождения (например, 15.05.1990):"))
		return true

	case 3:
		birthDate := strings.TrimSpace(message.Text)
		if birthDate == "" {
			_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Пожалуйста, напишите дату рождения (например, 15.05.1990)."))
			return true
		}
		state.BirthDate = birthDate
		regMu.Lock()
		delete(regStateByChat, chatID)
		regMu.Unlock()
		SendCabinetMenu(bot, chatID, "Регистрация завершена. Спасибо! Добро пожаловать в личный кабинет.\n\nВаши данные приняты:\n• Телефон: "+state.Phone+"\n• ФИО: "+state.FIO+"\n• Дата рождения: "+state.BirthDate)
		return true
	}

	return false
}

// SendCabinetMenu отправляет сообщение с меню личного кабинета (6 кнопок).
// Текст — приветствие или описание (например, после регистрации).
// Кнопка «Цифра дня» здесь сразу открывает Mini App, как и в разделе «Подарок».
func SendCabinetMenu(bot *tgbotapi.BotAPI, chatID int64, text string) {
	token := strings.TrimSpace(os.Getenv("BOT_TOKEN"))
	miniappURL := strings.TrimSpace(os.Getenv("MINI_APP_URL"))
	if miniappURL == "" {
		miniappURL = "https://localhost:5173/"
	}
	buttonURL := miniappURL
	if strings.Contains(buttonURL, "localhost") {
		buttonURL = "https://example.com"
	}

	// Если по какой-то причине токен не найден (не должен случаться),
	// используем запасной вариант через bot.Send без Mini App.
	if token == "" {
		msg := tgbotapi.NewMessage(chatID, text)
		msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
			tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Редактировать профиль", "cabinet_profile")),
			tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Мои разборы", "cabinet_my_reviews")),
			tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Матрица по дате рождения", "cabinet_matrix")),
			tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Цифра дня", "cabinet_number_day")),
			tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Обучение", "cabinet_education")),
			tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Перейти на главную", "ai_coach_main_menu")),
		)
		if _, err := bot.Send(msg); err != nil {
			log.Printf("ERROR sending cabinet menu (fallback): %v", err)
		}
		return
	}

	replyMarkup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": "Редактировать профиль", "callback_data": "cabinet_profile"},
			},
			{
				{"text": "Мои разборы", "callback_data": "cabinet_my_reviews"},
			},
			{
				{"text": "Матрица по дате рождения", "callback_data": "cabinet_matrix"},
			},
			{
				// Здесь сразу Mini App «Цифра дня».
				{"text": "Цифра дня", "web_app": map[string]string{"url": buttonURL}},
			},
			{
				{"text": "Обучение", "callback_data": "cabinet_education"},
			},
			{
				{"text": "Перейти на главную", "callback_data": "ai_coach_main_menu"},
			},
		},
	}
	markupJSON, _ := json.Marshal(replyMarkup)

	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	_ = w.WriteField("chat_id", strconv.FormatInt(chatID, 10))
	_ = w.WriteField("text", text)
	_ = w.WriteField("reply_markup", string(markupJSON))
	_ = w.Close()

	req, err := http.NewRequest(http.MethodPost, "https://api.telegram.org/bot"+token+"/sendMessage", body)
	if err != nil {
		log.Printf("ERROR SendCabinetMenu request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "multipart/form-data; boundary="+w.Boundary())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("ERROR SendCabinetMenu sendMessage: %v", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		log.Printf("ERROR SendCabinetMenu response: %d %s", resp.StatusCode, string(b))
	}
}

// SendEditProfileMenu показывает кнопки, что именно редактировать в профиле.
func SendEditProfileMenu(bot *tgbotapi.BotAPI, chatID int64) {
	msg := tgbotapi.NewMessage(chatID, "Что вы хотите изменить в профиле?")
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Телефон", "cabinet_edit_phone"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("ФИО", "cabinet_edit_fio"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Дата рождения", "cabinet_edit_birthdate"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending edit profile menu: %v", err)
	}
}
