package cabinet

import (
	"log"
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
func SendCabinetMenu(bot *tgbotapi.BotAPI, chatID int64, text string) {
	msg := tgbotapi.NewMessage(chatID, text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Профиль", "cabinet_profile")),
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Мои разборы", "cabinet_my_reviews")),
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Матрица по дате рождения", "cabinet_matrix")),
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Цифра дня", "cabinet_number_day")),
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Обучение", "cabinet_education")),
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("Перейти на главную", "ai_coach_main_menu")),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending cabinet menu: %v", err)
	}
}
