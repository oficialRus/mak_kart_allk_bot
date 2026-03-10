package cabinet

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"

	"mak_kart_allk_bot/internal/repository"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

const (
	cabinetPlaceholderURL = "https://placehold.co/600x400/2c5282/eee/png?text=Личный+кабинет"
	cabinetCaption        = "Личный кабинет — для доступа к персональным материалам и настройкам пройдите регистрацию."
)

// regMode описывает сценарий регистрации: полная или только телефон.
type regMode string

const (
	regModeFull      regMode = "full"
	regModePhoneOnly regMode = "phone_only"
)

type regState struct {
	Step      int
	Phone     string
	FIO       string
	BirthDate string
	Mode      regMode
}

var (
	regMu         sync.Mutex
	regStateByChat = make(map[int64]*regState)
)

// Handle обрабатывает нажатие на кнопку «Личный кабинет».
// Логика:
// 1) Если профиля ещё нет — запускаем полную регистрацию (телефон, ФИО, дата рождения).
// 2) Если есть профиль, но не заполнен телефон — просим только телефон.
// 3) Если профиль полностью заполнен — показываем меню личного кабинета.
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	ctx := context.Background()
	profile, err := repository.GetProfile(ctx, chatID)
	if err != nil {
		log.Printf("ERROR cabinet Handle: get profile failed for chat %d: %v", chatID, err)
		// Фоллбэк: старое поведение — заглушка и кнопка регистрации.
		photo := tgbotapi.NewPhoto(chatID, tgbotapi.FileURL(cabinetPlaceholderURL))
		photo.Caption = cabinetCaption
		photo.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("📝 Пройти регистрацию", "cabinet_register"),
			),
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_main_menu"),
			),
		)
		if _, err := bot.Send(photo); err != nil {
			log.Printf("ERROR sending cabinet message: %v", err)
		}
		return
	}

	// Если профиля нет — полная регистрация.
	if profile == nil {
		StartRegistration(bot, chatID)
		return
	}

	missingFullName := strings.TrimSpace(profile.FullName) == ""
	missingBirth := strings.TrimSpace(profile.BirthDate) == ""
	missingPhone := strings.TrimSpace(profile.Phone) == ""

	// Профиль полностью заполнен — сразу показываем меню.
	if !missingFullName && !missingBirth && !missingPhone {
		SendCabinetMenu(bot, chatID, "Ваш профиль уже заполнен. Добро пожаловать в личный кабинет.")
		return
	}

	// Если не хватает только телефона — запускаем короткий сценарий: запрос телефона.
	if missingPhone && !missingFullName && !missingBirth {
		StartPhoneOnlyRegistration(bot, chatID)
		return
	}

	// Во всех остальных случаях (нет ФИО или даты рождения) — полная регистрация.
	StartRegistration(bot, chatID)
}

// StartRegistration запускает полную пошаговую регистрацию: шаг 1 — номер телефона.
func StartRegistration(bot *tgbotapi.BotAPI, chatID int64) {
	regMu.Lock()
	regStateByChat[chatID] = &regState{
		Step: 1,
		Mode: regModeFull,
	}
	regMu.Unlock()

	msg := tgbotapi.NewMessage(chatID, "Шаг 1 из 3. Отправьте номер телефона (нажмите кнопку ниже или напишите в чат):")
	keyboard := tgbotapi.NewReplyKeyboard(
		tgbotapi.NewKeyboardButtonRow(
			tgbotapi.NewKeyboardButtonContact("📲 Отправить номер телефона"),
		),
	)
	keyboard.OneTimeKeyboard = true
	msg.ReplyMarkup = keyboard
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending registration step 1: %v", err)
	}
}

// StartPhoneOnlyRegistration запускает короткий сценарий — запрос только телефона.
// Используется, если ФИО и дата рождения уже есть в профиле, но телефон ещё не заполнен.
func StartPhoneOnlyRegistration(bot *tgbotapi.BotAPI, chatID int64) {
	regMu.Lock()
	regStateByChat[chatID] = &regState{
		Step: 1,
		Mode: regModePhoneOnly,
	}
	regMu.Unlock()

	msg := tgbotapi.NewMessage(chatID, "В вашем профиле не указан номер телефона.\nПожалуйста, отправьте ваш официальный номер Telegram (нажмите кнопку ниже или напишите в чат):")
	keyboard := tgbotapi.NewReplyKeyboard(
		tgbotapi.NewKeyboardButtonRow(
			tgbotapi.NewKeyboardButtonContact("📲 Отправить номер телефона"),
		),
	)
	keyboard.OneTimeKeyboard = true
	msg.ReplyMarkup = keyboard
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending phone-only registration step: %v", err)
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

		// Если это короткий сценарий «только телефон», сохраняем только номер и завершаем.
		if state.Mode == regModePhoneOnly {
			regMu.Lock()
			delete(regStateByChat, chatID)
			regMu.Unlock()

			profile, err := repository.GetProfile(context.Background(), chatID)
			if err != nil {
				log.Printf("ERROR phone-only registration: get profile failed for chat %d: %v", chatID, err)
				_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Произошла ошибка при загрузке профиля. Попробуйте ещё раз."))
				return true
			}
			if profile == nil {
				log.Printf("ERROR phone-only registration: profile not found for chat %d", chatID)
				_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Профиль не найден, пожалуйста, пройдите полную регистрацию."))
				StartRegistration(bot, chatID)
				return true
			}

			if err := repository.SaveProfile(context.Background(), chatID, profile.FullName, profile.BirthDate, state.Phone); err != nil {
				log.Printf("ERROR phone-only registration: save profile failed for chat %d: %v", chatID, err)
				_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Произошла ошибка при сохранении телефона. Попробуйте ещё раз."))
				return true
			}
			log.Printf("Phone-only profile update for chat %d: Phone=%s", chatID, state.Phone)

			// Убираем клавиатуру контакта и показываем меню кабинета.
			removeMsg := tgbotapi.NewMessage(chatID, "Спасибо! Ваш номер телефона обновлён.\nВы можете перейти в личный кабинет.")
			removeMsg.ReplyMarkup = tgbotapi.NewRemoveKeyboard(true)
			if _, err := bot.Send(removeMsg); err != nil {
				log.Printf("ERROR sending phone-only confirmation: %v", err)
			}

			SendCabinetMenu(bot, chatID, "Ваш номер телефона сохранён. Добро пожаловать в личный кабинет.")
			return true
		}

		// Полный сценарий: переходим к шагу 2 (ФИО).
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

		if err := repository.SaveProfile(context.Background(), chatID, state.FIO, state.BirthDate, state.Phone); err != nil {
			log.Printf("ERROR saving profile for chat %d: %v", chatID, err)
			_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Произошла ошибка при сохранении данных. Попробуйте ещё раз."))
			return true
		}
		log.Printf("Profile saved for chat %d: FIO=%s, BirthDate=%s, Phone=%s", chatID, state.FIO, state.BirthDate, state.Phone)

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
			tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("✏️ Редактировать профиль", "cabinet_profile")),
			tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("📂 Мои разборы", "cabinet_my_reviews")),
			tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("🧮 Матрица по дате рождения", "cabinet_matrix")),
			tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("🔢 Цифра дня", "cabinet_number_day")),
			tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("📚 Обучение", "cabinet_education")),
			tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("🏠 Перейти на главную", "ai_coach_main_menu")),
		)
		if _, err := bot.Send(msg); err != nil {
			log.Printf("ERROR sending cabinet menu (fallback): %v", err)
		}
		return
	}

	replyMarkup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": "👤 Мои данные", "callback_data": "cabinet_my_data"},
			},
			{
				{"text": "✏️ Редактировать профиль", "callback_data": "cabinet_profile"},
			},
			{
				{"text": "📂 Мои разборы", "callback_data": "cabinet_my_reviews"},
			},
			{
				{"text": "🧮 Матрица по дате рождения", "callback_data": "cabinet_matrix"},
			},
			{
				// Здесь сразу Mini App «Цифра дня».
				{"text": "🔢 Цифра дня", "web_app": map[string]string{"url": buttonURL}},
			},
			{
				{"text": "📚 Обучение", "callback_data": "cabinet_education"},
			},
			{
				{"text": "🏠 Перейти на главную", "callback_data": "ai_coach_main_menu"},
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
			tgbotapi.NewInlineKeyboardButtonData("📞 Телефон", "cabinet_edit_phone"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("👤 ФИО", "cabinet_edit_fio"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🎂 Дата рождения", "cabinet_edit_birthdate"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending edit profile menu: %v", err)
	}
}

// SendProfileSummary показывает пользователю его текущие данные профиля.
func SendProfileSummary(bot *tgbotapi.BotAPI, chatID int64) {
	ctx := context.Background()
	p, err := repository.GetProfile(ctx, chatID)
	if err != nil {
		log.Printf("ERROR SendProfileSummary: get profile failed for chat %d: %v", chatID, err)
		_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Произошла ошибка при загрузке ваших данных. Попробуйте ещё раз позже."))
		return
	}

	if p == nil {
		_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Ваш профиль ещё не заполнен. Пройдите короткую регистрацию, чтобы сохранить ваши данные."))
		StartRegistration(bot, chatID)
		return
	}

	fullName := strings.TrimSpace(p.FullName)
	if fullName == "" {
		fullName = "— не указано —"
	}
	birth := strings.TrimSpace(p.BirthDate)
	if birth == "" {
		birth = "— не указано —"
	}
	phone := strings.TrimSpace(p.Phone)
	if phone == "" {
		phone = "— не указан —"
	}

	text := fmt.Sprintf(
		"👤 Ваши данные профиля:\n\n• ФИО: %s\n• Дата рождения: %s\n• Телефон: %s",
		fullName, birth, phone,
	)

	msg := tgbotapi.NewMessage(chatID, text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("✏️ Редактировать профиль", "cabinet_profile"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("⬅️ В личный кабинет", "main_menu_cabinet"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending profile summary: %v", err)
	}
}
