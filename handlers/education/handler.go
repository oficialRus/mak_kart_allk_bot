package education

import (
	"log"
	"strings"
	"sync"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

const (
	// Локальный путь к красивой картинке раздела «Обучение».
	// Поместите файл с изображением сюда (например, education.png).
	educationImagePath   = "cmd/bot/images/education.png"
	educationDescription = "Здесь вы найдёте обучающие материалы, уроки и практики от психолога.\nОни помогут лучше понимать себя, развивать навыки и применить знания в жизни.\nВыберите тему ниже или вернитесь в меню."
)

// Handle обрабатывает нажатие на кнопку «Обучение»: отправляет картинку раздела,
// текст-описание и две кнопки внизу.
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	keyboard := tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("📝 Пройти опрос", "education_survey")),
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_main_menu")),
	)

	photo := tgbotapi.NewPhoto(chatID, tgbotapi.FilePath(educationImagePath))
	photo.Caption = educationDescription
	photo.ReplyMarkup = keyboard
	if _, err := bot.Send(photo); err != nil {
		log.Printf("ERROR sending education image, fallback to text: %v", err)
		msg := tgbotapi.NewMessage(chatID, educationDescription)
		msg.ReplyMarkup = keyboard
		if _, err2 := bot.Send(msg); err2 != nil {
			log.Printf("ERROR sending education fallback message: %v", err2)
		}
	}
}

// ===== Опрос в разделе «Обучение» =====

type surveySession struct {
	Step    int
	Level   string
	UsedMAC string
	Goal    string
}

var (
	surveyMu       sync.Mutex
	surveySessions = make(map[int64]*surveySession)
)

// HandleSurveyCallback обрабатывает все callback'и, связанные с опросом в разделе «Обучение».
// Возвращает true, если callback обработан здесь, и false, если это не наш callback.
func HandleSurveyCallback(bot *tgbotapi.BotAPI, chatID int64, data string) bool {
	if data != "education_survey" && !strings.HasPrefix(data, "education_survey_q") {
		return false
	}

	var action string
	var finalText string

	surveyMu.Lock()
	session, ok := surveySessions[chatID]
	if !ok {
		session = &surveySession{}
		surveySessions[chatID] = session
	}

	switch {
	case data == "education_survey":
		// Старт опроса — показываем первый вопрос.
		session.Step = 1
		action = "q1"

	case strings.HasPrefix(data, "education_survey_q1_"):
		// Ответ на первый вопрос.
		switch data {
		case "education_survey_q1_novice":
			session.Level = "Новичок"
		case "education_survey_q1_middle":
			session.Level = "Средний"
		case "education_survey_q1_pro":
			session.Level = "Профессионал"
		}
		session.Step = 2
		action = "q2"

	case strings.HasPrefix(data, "education_survey_q2_"):
		// Ответ на второй вопрос.
		switch data {
		case "education_survey_q2_yes":
			session.UsedMAC = "Да, уже использовал(а) МАК"
		case "education_survey_q2_no":
			session.UsedMAC = "Нет, не использовал(а) МАК"
		}
		session.Step = 3
		action = "q3"

	case strings.HasPrefix(data, "education_survey_q3_"):
		// Ответ на третий вопрос и завершение опроса.
		switch data {
		case "education_survey_q3_self":
			session.Goal = "Самопознание"
		case "education_survey_q3_answer":
			session.Goal = "Найти ответ на вопрос"
		case "education_survey_q3_problem":
			session.Goal = "Решить проблему"
		case "education_survey_q3_motivation":
			session.Goal = "Мотивация на день"
		case "education_survey_q3_other":
			session.Goal = "Другое"
		}

		finalText = "Спасибо! Вы прошли опрос.\n\n" +
			"1. Ваш уровень: " + safeValue(session.Level, "не указан") + "\n" +
			"2. Опыт использования МАК: " + safeValue(session.UsedMAC, "не указан") + "\n" +
			"3. Ваша цель в работе с МАК: " + safeValue(session.Goal, "не указана")

		// После завершения можно очистить сессию.
		delete(surveySessions, chatID)
		action = "final"
	}

	surveyMu.Unlock()

	switch action {
	case "q1":
		sendSurveyQuestion1(bot, chatID)
	case "q2":
		sendSurveyQuestion2(bot, chatID)
	case "q3":
		sendSurveyQuestion3(bot, chatID)
	case "final":
		sendSurveyFinal(bot, chatID, finalText)
	default:
		return false
	}

	return true
}

func safeValue(v, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return v
}

func sendSurveyQuestion1(bot *tgbotapi.BotAPI, chatID int64) {
	text := "1. Уровень в работе с МАК:\n\nВыберите, что вам ближе."
	msg := tgbotapi.NewMessage(chatID, text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🌱 Новичок", "education_survey_q1_novice"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("📈 Средний", "education_survey_q1_middle"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("⭐ Профессионал", "education_survey_q1_pro"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending education survey q1: %v", err)
	}
}

func sendSurveyQuestion2(bot *tgbotapi.BotAPI, chatID int64) {
	text := "2. Ранее вы использовали МАК?\n\nВыберите вариант."
	msg := tgbotapi.NewMessage(chatID, text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("✅ Да", "education_survey_q2_yes"),
			tgbotapi.NewInlineKeyboardButtonData("❌ Нет", "education_survey_q2_no"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending education survey q2: %v", err)
	}
}

func sendSurveyQuestion3(bot *tgbotapi.BotAPI, chatID int64) {
	text := "3. Цель вашей работы с МАК:\n\nВыберите основную цель."
	msg := tgbotapi.NewMessage(chatID, text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🔍 Самопознание", "education_survey_q3_self"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("💡 Найти ответ на вопрос", "education_survey_q3_answer"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🧩 Решить проблему", "education_survey_q3_problem"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("⚡ Мотивация на день", "education_survey_q3_motivation"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("➕ Другое", "education_survey_q3_other"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending education survey q3: %v", err)
	}
}

func sendSurveyFinal(bot *tgbotapi.BotAPI, chatID int64, text string) {
	msg := tgbotapi.NewMessage(chatID, text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("📚 Вернуться в «Обучение»", "main_menu_education"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🏠 Главное меню", "ai_coach_main_menu"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending education survey final: %v", err)
	}
}
