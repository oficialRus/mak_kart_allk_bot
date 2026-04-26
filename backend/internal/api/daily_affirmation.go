package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"mak_kart_allk_bot/internal/db"
	"mak_kart_allk_bot/openai"
)

const dailyAffirmationSystemPrompt = `Ты — автор глубоких, тёплых и психологически грамотных аффирмаций дня. Твоя задача — каждый раз создавать ОДНУ уникальную аффирмацию на текущую дату в красивом, мягком и вдохновляющем формате.

Сгенерируй аффирмацию строго по этим правилам:

1. Формат ответа всегда такой:

✨Аффирмация дня - ДД.ММ.ГГГГ✨

"Текст аффирмации"

2. Дата должна быть указана в заголовке.
3. Аффирмация должна быть написана на русском языке.
4. Текст должен быть цельным, красивым, плавным, естественным и звучать как живая поддерживающая мысль, а не как сухой шаблон.
5. Объём аффирмации: 2–4 содержательных предложения.
6. Аффирмация должна быть уникальной по формулировке, ритму, образам и построению фраз, не повторять дословно прошлые варианты.
7. Основа аффирмации:
   - внутреннее спокойствие
   - уверенность
   - опора на себя
   - доверие жизни
   - благодарность
   - мягкое движение вперёд
   - открытость возможностям
   - гармония с собой и днём
8. Аффирмация должна помогать человеку:
   - успокоиться
   - почувствовать внутреннюю опору
   - настроиться на хороший день
   - мягко перейти к действиям
9. Используй только позитивные и экологичные формулировки.
10. Не используй частицу «не», жёсткие формулировки, давление, магическое мышление, пафос, обещания богатства, всемогущества или мгновенного изменения жизни.
11. Аффирмация должна быть реалистичной и вызывать внутреннее согласие.
12. Можно использовать слова и обороты вроде:
   - «я открыт(а)»
   - «я с благодарностью принимаю»
   - «я позволяю себе»
   - «я чувствую»
   - «я выбираю»
   - «я доверяю»
   - «с лёгкостью»
   - «с теплом»
   - «спокойно»
   - «бережно»
13. Тон должен быть:
   - тёплый
   - глубокий
   - красивый
   - поддерживающий
   - современный
   - без эзотерической перегруженности
14. Не добавляй пояснений, вступлений, комментариев или списков. Только итоговую аффирмацию в нужном формате.
15. Каждый новый ответ должен отличаться от предыдущих по смысловым акцентам и лексике.`

type dailyAffirmationRequest struct {
	InitData string `json:"initData"`
}

type dailyAffirmationResponse struct {
	Affirmation string `json:"affirmation"`
}

func DailyAffirmationHandler(botToken string) http.HandlerFunc {
	return withSessionOrInitData(botToken, func(w http.ResponseWriter, r *http.Request, userID int64) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req dailyAffirmationRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}
		forDate := moscowDateUTC()
		dateLabel := moscowDateLabel()

		var cached sql.NullString
		err := db.Pool.QueryRowContext(
			r.Context(),
			`SELECT affirmation FROM mini_app_daily_affirmations WHERE telegram_id = $1 AND for_date = $2`,
			userID,
			forDate,
		).Scan(&cached)
		if err == nil && strings.TrimSpace(cached.String) != "" {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			_ = json.NewEncoder(w).Encode(dailyAffirmationResponse{Affirmation: cached.String})
			return
		}
		if err != nil && err != sql.ErrNoRows {
			log.Printf("api daily-affirmation: select cached failed for user_id=%d: %v", userID, err)
		}

		affirmation := fallbackDailyAffirmation(dateLabel)
		apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
		if apiKey != "" {
			userPrompt := "Теперь сгенерируй новую уникальную аффирмацию дня на указанную дату.\n\nДата: " + dateLabel
			resp, userErr := openai.ChatCompletion(r.Context(), apiKey, openai.Request{
				Model: openai.DefaultModel,
				Messages: []openai.Message{
					{Role: "system", Content: dailyAffirmationSystemPrompt},
					{Role: "user", Content: userPrompt},
				},
			})
			if userErr != nil {
				log.Printf("api daily-affirmation: completion error: %v", userErr)
			} else if len(resp.Choices) > 0 {
				candidate := strings.TrimSpace(resp.Choices[0].Message.Content)
				if candidate != "" {
					affirmation = candidate
				}
			}
		}

		if _, err := db.Pool.ExecContext(
			r.Context(),
			`INSERT INTO mini_app_daily_affirmations (telegram_id, for_date, affirmation)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (telegram_id, for_date) DO UPDATE SET affirmation = EXCLUDED.affirmation`,
			userID,
			forDate,
			affirmation,
		); err != nil {
			log.Printf("api daily-affirmation: upsert cache failed for user_id=%d: %v", userID, err)
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(dailyAffirmationResponse{Affirmation: affirmation})
	})
}

func moscowDateLabel() string {
	msk := time.FixedZone("MSK", 3*60*60)
	return time.Now().In(msk).Format("02.01.2006")
}

func moscowDateUTC() time.Time {
	msk := time.FixedZone("MSK", 3*60*60)
	local := time.Now().In(msk)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
}

func fallbackDailyAffirmation(dateLabel string) string {
	return "✨Аффирмация дня - " + dateLabel + "✨\n\n" +
		"\"Я встречаю этот день в состоянии внутреннего спокойствия и ясности. " +
		"Я чувствую опору в себе, с благодарностью принимаю каждый шаг и мягко двигаюсь вперёд. " +
		"Я открыт(а) возможностям этого дня и выбираю действовать бережно, с теплом к себе.\""
}

