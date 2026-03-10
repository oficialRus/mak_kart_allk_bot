package technique

import (
	"log"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

// Локальная картинка для раздела «Техники».
const techniqueImagePath = "cmd/bot/images/technique.png"

const technique1Text = `Техника №1: «Я выбираю быть. Письмо себе из будущего» с AR-визуализацией
1.	Выберите карту, символизирующую ваше будущее «я». Если при взгляде на карту тревога выше 6 из 10, смените карту.
2.	Запустите AR-ролик (1–3 минуты). Смотрите без анализа, воспринимайте как возможное будущее. Мотивационная озвучка — голос вашего будущего «я». Смотрите как наблюдатель, не верьте каждому слову, достаточно допустить возможность.
3.	Закройте глаза, сделайте глубокий вдох и представьте себя через год. Ответьте на вопросы:
o	Что этот человек понял о себе?
o	От чего он отказался?
o	Как он поддерживает себя в трудные моменты?
4.	Напишите письмо себе в будущее, укажите дату и положите в коробку на месяц.
5.	Прочитайте письмо и выберите один маленький, выполнимый шаг. Не глобальный — именно конкретный.
6.	Читайте письмо 3 раза в неделю в течение недели. Задача — внедрить в свою жизнь указанные изменения.
Повторяя практику, анализируйте, что изменилось, а что нет. Если достигли изменений — сделайте самолёт из письма, запустите его из окна и скажите: «Я выбрала быть… и я стала».`

const technique2Text = `Техника №2: «Путь принятия себя через образ» с AR-визуализацией.

1.	Выберите карту (открытую или закрытую) и внимательно изучите её посыл.
2.	Оцените свои эмоции, посмотрев на карту. Позвольте себе почувствовать их.
3.	Включите AR-ролик с мотивационной озвучкой. Представьте, как образ на карте появляется в реальной жизни.
4.	Взаимодействуйте с образом как с вашим внутренним барьером. Представьте, как вы «удаляете» его и освобождаете себя. Почувствуйте лёгкость и подъем энергии.
5.	Закройте глаза, сделайте вдох, почувствуйте момент.
6.	Произнесите фразу с карты: «Я выбираю быть…» и прочувствуйте её каждым словом.
7.	Повторите фразу 7 раз, усиливая уверенность. На 7-м разе скажите громче, с полным осознанием снятия запрета.
8.	Сделайте хотя бы один маленький шаг в направлении, которое подсказывает карта.
9.	Повторяйте практику до 5 раз, используя AR-визуализацию для закрепления изменений.`

const technique3Text = `Техника №3: «Три карты дня»
1.	Выберите первую карту «Настоящего», она показывает, каким вы видите и ощущаете себя сейчас. Важно честно почувствовать своё состояние, эмоции и внутреннее настроение.
2.	Выберите вторую карту «Прошлого», она отражает ваши прошлые достижения, страхи и преграды, с которыми вы сталкивались. Обратите внимание на уроки и ресурсы, которые уже у вас есть.
3.	Выберите третью карту «Будущего», она показывает, кем вы хотите стать и какие изменения хотите внести в себя. Используйте её как образ вашего идеального будущего мира.
4.	Запустите AR-визуализацию: карты оживают, появляются ассоциативные образы и видео.
5.	Проанализируйте три карты вместе, сравните их между собой, обратите внимание на повторяющиеся темы, контрасты и связи, цвета и образы. Подумайте, как прошлое и настоящее могут помочь вам создать желаемое будущее.
6.	Возьмите карты с собой на день, пусть они будут напоминанием: изменяя себя сегодня, вы создаёте свой идеальный мир завтра. 
Не бойтесь идти к своей цели и мечтам!`

const technique4Text = `Техника №4: «Внутренний диалог с критиком: голос выбора с AR-визуализацией»
1.	Выберите карту, вызывающую сильные эмоции и дискомфорт, и представьте, что это ваш внутренний критик (тревога, сомнение, напряжение).
2.	Проанализируйте карту: что она символизирует для вас в данный момент? Какие элементы ассоциируются с вашим внутренним состоянием? Позвольте эмоциям выйти. 
3.	Запишите свои чувства: например, «Я чувствую себя потерянным, как этот туманный лес».
4.	Выберите вторую карту, символизирующую поддержку, силу, покой, уверенность и гармонию.
5.	Запустите AR-визуализацию, с мотивационной озвучкой. Визуализируйте, как образы на картах оживают. Ответьте на вопрос в конце видео.
6.	Задайте себе вопрос: «Как я могу больше доверять себе?»
7.	Повторите мотивационные фразы из видео 7 раз. Почувствуйте, как уверенность нарастает, а внутренний критик теряет силу.
8.	Запишите свои мысли и утверждения, которые помогут вам двигаться к желаемому состоянию. 
9.	Завершите практику глубокими вдохами, ощущая обновление энергии и принятие себя.`

const technique5Text = `Техника №5 «День в гармонии»
1.	Каждое утро (или когда почувствуете необходимость) выберите одну карту интуитивно. Лучше всего делать это до начала дня, чтобы настроиться на предстоящие события.
2.	Посмотрите на изображение карты. Какие чувства, эмоции и мысли оно вызывает? Обратите внимание на цвета, символы и детали. Это первый сигнал о том, что важно для вас сегодня.
3.	Прочитайте название карты. Сопоставьте его с тем, что вам подсказывает образ. Это поможет вам понять, что именно нужно учитывать в данный момент жизни. Иногда текст и образ могут давать разные подсказки — следуйте тому, что наиболее откликается.
4.	Запишите ключевые осознания, которые возникли после работы с картой. Что вам стало ясно? Какие шаги или действия необходимо предпринять? Это могут быть небольшие, но конкретные вещи: например, записать задачу в список дел, позвонить кому-то или настроиться на важную встречу.
5.	Не откладывайте действия. Реализуйте хотя бы один шаг из полученных осознаний. Это поможет вам двигаться в правильном направлении и начать день с конкретных поступков.`

const technique6Text = `Техника №6 «Вопрос-ответ»
1.	Определите, что именно вам нужно понять или решить. Чем яснее и конкретнее будет вопрос, тем точнее будет ответ. 
2.	Перемешайте колоду и интуитивно выберите одну карту. Дайте себе время почувствовать, какая карта «откликается» сейчас. Посмотрите на изображение и текст карты. Прочтите описание карты, обратить внимание на эмоции, ощущения, которые вызывает образ. Какие ассоциации возникают? Какие элементы карты выделяются наиболее сильно? 
3.	Проанализируйте, как карта соотносится с вашим вопросом. Как она может раскрыть ваш запрос? 
4.	Используйте приложение для взаимодействия с картой, чтобы сразу же увидеть, как она оживает через AR (дополненную реальность) и сопровождается коротким видео с озвучкой. Как только вы выбрали карту и увидели, как она оживает в приложении, сосредоточьтесь на её образе и видео.
5.	Используйте полученный ответ для принятия решения или для изменения своего подхода. Карты помогут вам взглянуть на ситуацию под новым углом, возможно, предложив решение, которое вы раньше не рассматривали. Запишите свои действия или идеи для дальнейшего шага.`

const technique7Text = `Техника №7 «Что скрывает взгляд»
1.	Выберите несколько карт из колоды случайным образом, не задумываясь. Вы можете вытянуть карты как в открытом, так и в закрытом виде — главное, не ограничивайте себя.
2.	Посмотрите на карты, не торопитесь. Позвольте своему вниманию фиксировать то, что в первую очередь привлекает вас — будь то цвет, форма, символы или образ. 
3.	Используйте приложение для взаимодействия с картой, чтобы сразу же увидеть, как она оживает через AR (дополненную реальность) и сопровождается коротким видео с озвучкой. Как только вы выбрали карту и увидели, как она оживает в приложении, сосредоточьтесь на её образе и видео.
4.	Погружайтесь в свои ощущения и ассоциации, которые возникли при взгляде на карты. Что эта карта вызывает в вас? Какие эмоции или мысли пришли в голову? Какие образы или символы оказались для вас особенно важными? 
5.	Задавайте себе открытые вопросы по каждой карте, чтобы глубже понять, что она вам пытается сказать.
6.	Сделайте выводы. Что нового вы узнали о себе или о том, что сейчас для вас важно? Не откладывайте — сделайте шаг к осознанному действию, которое поможет вам двигаться вперед.`

const technique8Text = `Техника №8 «Зеркало души»
1.	Найдите спокойное место, сделайте несколько глубоких вдохов и настройтесь на день. Попросите себя: что важно сегодня?
2.	Перемешайте колоду и интуитивно выберите три карты. Важно, чтобы каждый выбор был осознанным.
3.	Сосредоточьтесь на первой карте. Какие эмоции, символы или детали вас привлекают. Позвольте себе почувствовать.
4.	Перейдите ко второй карте. Чем она отличается от первой? Какие вопросы она вызывает? Исследуйте её скрытые смыслы.
5.	Проанализируйте третью карту. Как она дополняет или контрастирует с предыдущими? Какие выводы она приносит?
6.	Используйте приложение для взаимодействия с картой, чтобы сразу же увидеть, как она оживает через AR (дополненную реальность) и сопровождается коротким видео с озвучкой. Как только вы выбрали карту и увидели, как она оживает в приложении, сосредоточьтесь на её образе и видео.
7.	Соедините карты в единую историю. Что они говорят вам вместе? Как эта история отражает ваше текущее состояние?
8.	Поставьте себе задачу и запишите мысли и действия, которые пришли во время работы с картами. Это поможет отслеживать ваш прогресс.`

// Handle обрабатывает нажатие на кнопку «Техника»: отправляет картинку-заглушку
// и список inline-кнопок в столбик (Техника_1 … Техника_5).
func Handle(bot *tgbotapi.BotAPI, chatID int64) {
	photo := tgbotapi.NewPhoto(chatID, tgbotapi.FilePath(techniqueImagePath))
	photo.Caption = "Психологические техники, которые помогут глубже понять себя\nи проработать ситуацию через метафорические карты.\n\nВыберите технику, чтобы узнать её описание\nили разобрать её вместе с ИИ-психологом."

	photo.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🧩 Техника 1", "technique_1"),
			tgbotapi.NewInlineKeyboardButtonData("🧩 Техника 2", "technique_2"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🧩 Техника 3", "technique_3"),
			tgbotapi.NewInlineKeyboardButtonData("🧩 Техника 4", "technique_4"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🧩 Техника 5", "technique_5"),
			tgbotapi.NewInlineKeyboardButtonData("🧩 Техника 6", "technique_6"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🧩 Техника 7", "technique_7"),
			tgbotapi.NewInlineKeyboardButtonData("🧩 Техника 8", "technique_8"),
		),
		tgbotapi.NewInlineKeyboardRow(tgbotapi.NewInlineKeyboardButtonData("🏠 Главное меню", "ai_coach_main_menu")),
	)

	if _, err := bot.Send(photo); err != nil {
		log.Printf("ERROR sending technique message: %v", err)
	}
}

// HandleTechnique1 отправляет описание техники №1.
func HandleTechnique1(bot *tgbotapi.BotAPI, chatID int64) {
	msg := tgbotapi.NewMessage(chatID, technique1Text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_technique"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Разобрать с психологом", "technique_discuss"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending technique 1 message: %v", err)
	}
}

// HandleTechnique2 отправляет описание техники №2.
func HandleTechnique2(bot *tgbotapi.BotAPI, chatID int64) {
	msg := tgbotapi.NewMessage(chatID, technique2Text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_technique"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Разобрать с психологом", "technique_discuss"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending technique 2 message: %v", err)
	}
}

// HandleTechnique3 отправляет описание техники №3.
func HandleTechnique3(bot *tgbotapi.BotAPI, chatID int64) {
	msg := tgbotapi.NewMessage(chatID, technique3Text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_technique"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Разобрать с психологом", "technique_discuss"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending technique 3 message: %v", err)
	}
}

// HandleTechnique4 отправляет описание техники №4.
func HandleTechnique4(bot *tgbotapi.BotAPI, chatID int64) {
	msg := tgbotapi.NewMessage(chatID, technique4Text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_technique"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Разобрать с психологом", "technique_discuss"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending technique 4 message: %v", err)
	}
}

// HandleTechnique5 отправляет описание техники №5.
func HandleTechnique5(bot *tgbotapi.BotAPI, chatID int64) {
	msg := tgbotapi.NewMessage(chatID, technique5Text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_technique"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Разобрать с психологом", "technique_discuss"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending technique 5 message: %v", err)
	}
}

// HandleTechnique6 отправляет описание техники №6.
func HandleTechnique6(bot *tgbotapi.BotAPI, chatID int64) {
	msg := tgbotapi.NewMessage(chatID, technique6Text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_technique"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Разобрать с психологом", "technique_discuss"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending technique 6 message: %v", err)
	}
}

// HandleTechnique7 отправляет описание техники №7.
func HandleTechnique7(bot *tgbotapi.BotAPI, chatID int64) {
	msg := tgbotapi.NewMessage(chatID, technique7Text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_technique"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Разобрать с психологом", "technique_discuss"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending technique 7 message: %v", err)
	}
}

// HandleTechnique8 отправляет описание техники №8.
func HandleTechnique8(bot *tgbotapi.BotAPI, chatID int64) {
	msg := tgbotapi.NewMessage(chatID, technique8Text)
	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("⬅️ Назад", "ai_coach_technique"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("Разобрать с психологом", "technique_discuss"),
		),
	)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("ERROR sending technique 8 message: %v", err)
	}
}
