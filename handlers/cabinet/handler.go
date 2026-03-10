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
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"mak_kart_allk_bot/internal/repository"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

var (
	fullNamePartRe = regexp.MustCompile(`^[A-Za-zА-ЯЁа-яё]+(?:-[A-Za-zА-ЯЁа-яё]+)?$`)
	birthDateRe    = regexp.MustCompile(`^(\d{1,2})\.(\d{1,2})\.(\d{4})$`)
)

// capitalizeNamePart делает первую букву заглавной, остальные строчными.
// Поддерживает части с дефисом: каждая подчасть капитализируется отдельно.
func capitalizeNamePart(s string) string {
	subParts := strings.Split(s, "-")
	for i, sp := range subParts {
		runes := []rune(strings.ToLower(sp))
		if len(runes) > 0 {
			runes[0] = unicode.ToUpper(runes[0])
		}
		subParts[i] = string(runes)
	}
	return strings.Join(subParts, "-")
}

// validateFullName проверяет и нормализует ФИО.
// Возвращает (нормализованное ФИО, "") при успехе или ("", сообщение об ошибке) при ошибке.
func validateFullName(raw string) (string, string) {
	trimmed := strings.TrimSpace(raw)
	// Схлопываем множественные пробелы
	spaceRe := regexp.MustCompile(`\s+`)
	trimmed = spaceRe.ReplaceAllString(trimmed, " ")

	if trimmed == "" {
		return "", "Пожалуйста, напишите вашу фамилию и имя текстом."
	}

	parts := strings.Fields(trimmed)
	if len(parts) < 2 {
		return "", "Укажите как минимум фамилию и имя. Например: Иванова Анна"
	}

	for _, p := range parts {
		if !fullNamePartRe.MatchString(p) {
			return "", "ФИО может содержать только буквы (кириллица или латиница), без цифр и спецсимволов. Каждая часть отдельно."
		}
	}

	normalized := make([]string, 0, len(parts))
	for _, p := range parts {
		normalized = append(normalized, capitalizeNamePart(p))
	}
	return strings.Join(normalized, " "), ""
}

// validateBirthDate проверяет и нормализует дату рождения.
// Возвращает (нормализованная дата "ДД.ММ.ГГГГ", "") при успехе или ("", сообщение об ошибке).
func validateBirthDate(raw string) (string, string) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", "Пожалуйста, напишите дату рождения. Например: 15.05.1990"
	}

	match := birthDateRe.FindStringSubmatch(trimmed)
	if match == nil {
		return "", "Введите дату в формате ДД.ММ.ГГГГ (например, 15.05.1990). Используйте только цифры и точки."
	}

	day, _ := strconv.Atoi(match[1])
	month, _ := strconv.Atoi(match[2])
	year, _ := strconv.Atoi(match[3])

	if month < 1 || month > 12 || day < 1 || day > 31 {
		return "", "Некорректная дата рождения. Проверьте день и месяц."
	}

	// Проверяем, что дата реально существует (например, 30.02 — нет)
	parsed := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	if parsed.Year() != year || int(parsed.Month()) != month || parsed.Day() != day {
		return "", "Такой даты не существует. Проверьте правильность."
	}

	if parsed.After(time.Now()) {
		return "", "Дата рождения не может быть в будущем."
	}
	if year < 1900 {
		return "", "Похоже на некорректный год рождения. Уточните, пожалуйста."
	}

	normalized := fmt.Sprintf("%02d.%02d.%d", day, month, year)
	return normalized, ""
}

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

// StartRegistration запускает полную пошаговую регистрацию: шаг 1 — ФИО.
func StartRegistration(bot *tgbotapi.BotAPI, chatID int64) {
	regMu.Lock()
	regStateByChat[chatID] = &regState{
		Step: 1,
		Mode: regModeFull,
	}
	regMu.Unlock()

	msg := tgbotapi.NewMessage(chatID, "Шаг 1 из 3. Напишите вашу фамилию и имя (можно с отчеством).\nПример: Иванова Анна или Иванова Анна Петровна")
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
//
// Полная регистрация (regModeFull):
//   Шаг 1 — ФИО (с валидацией)
//   Шаг 2 — Дата рождения (с валидацией)
//   Шаг 3 — Номер телефона (кнопка контакта)
//
// Только телефон (regModePhoneOnly):
//   Шаг 1 — Номер телефона (кнопка контакта)
func HandleRegistrationMessage(bot *tgbotapi.BotAPI, chatID int64, message *tgbotapi.Message) bool {
	regMu.Lock()
	state, ok := regStateByChat[chatID]
	regMu.Unlock()
	if !ok || state == nil {
		return false
	}

	// ── Сценарий «только телефон» (пришёл из мини-приложения, ФИО и дата уже есть) ──
	if state.Mode == regModePhoneOnly {
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

		removeMsg := tgbotapi.NewMessage(chatID, "Спасибо! Ваш номер телефона обновлён.\nВы можете перейти в личный кабинет.")
		removeMsg.ReplyMarkup = tgbotapi.NewRemoveKeyboard(true)
		if _, err := bot.Send(removeMsg); err != nil {
			log.Printf("ERROR sending phone-only confirmation: %v", err)
		}

		SendCabinetMenu(bot, chatID, "Ваш номер телефона сохранён. Добро пожаловать в личный кабинет.")
		return true
	}

	// ── Полная регистрация (regModeFull) ──
	switch state.Step {
	case 1:
		// Шаг 1: ФИО с валидацией
		raw := strings.TrimSpace(message.Text)
		normalized, errMsg := validateFullName(raw)
		if errMsg != "" {
			_, _ = bot.Send(tgbotapi.NewMessage(chatID, errMsg))
			return true
		}
		state.FIO = normalized
		state.Step = 2
		_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Шаг 2 из 3. Напишите вашу дату рождения (например, 15.05.1990):"))
		return true

	case 2:
		// Шаг 2: Дата рождения с валидацией
		raw := strings.TrimSpace(message.Text)
		normalized, errMsg := validateBirthDate(raw)
		if errMsg != "" {
			_, _ = bot.Send(tgbotapi.NewMessage(chatID, errMsg))
			return true
		}
		state.BirthDate = normalized
		state.Step = 3

		// Показываем кнопку «Отправить номер телефона»
		phoneMsg := tgbotapi.NewMessage(chatID, "Шаг 3 из 3. Отправьте номер телефона (нажмите кнопку ниже или напишите в чат):")
		keyboard := tgbotapi.NewReplyKeyboard(
			tgbotapi.NewKeyboardButtonRow(
				tgbotapi.NewKeyboardButtonContact("📲 Отправить номер телефона"),
			),
		)
		keyboard.OneTimeKeyboard = true
		phoneMsg.ReplyMarkup = keyboard
		if _, err := bot.Send(phoneMsg); err != nil {
			log.Printf("ERROR sending registration step 3 prompt: %v", err)
		}
		return true

	case 3:
		// Шаг 3: Номер телефона
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

		regMu.Lock()
		delete(regStateByChat, chatID)
		regMu.Unlock()

		if err := repository.SaveProfile(context.Background(), chatID, state.FIO, state.BirthDate, state.Phone); err != nil {
			log.Printf("ERROR saving profile for chat %d: %v", chatID, err)
			_, _ = bot.Send(tgbotapi.NewMessage(chatID, "Произошла ошибка при сохранении данных. Попробуйте ещё раз."))
			return true
		}
		log.Printf("Profile saved for chat %d: FIO=%s, BirthDate=%s, Phone=%s", chatID, state.FIO, state.BirthDate, state.Phone)

		// Убираем клавиатуру контакта, затем показываем меню кабинета
		removeMsg := tgbotapi.NewMessage(chatID, "Отлично! Данные получены.")
		removeMsg.ReplyMarkup = tgbotapi.NewRemoveKeyboard(true)
		if _, err := bot.Send(removeMsg); err != nil {
			log.Printf("ERROR removing keyboard after registration: %v", err)
		}

		SendCabinetMenu(bot, chatID, "Регистрация завершена. Добро пожаловать в личный кабинет!\n\nВаши данные:\n• ФИО: "+state.FIO+"\n• Дата рождения: "+state.BirthDate+"\n• Телефон: "+state.Phone)
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
			tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("🧠 Цифровой психолог", "cabinet_digital_psychologist")),
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
				{"text": "🧠 Цифровой психолог", "callback_data": "cabinet_digital_psychologist"},
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
