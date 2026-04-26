# План проекта: MAK Kart — Telegram-бот (МАК-карты и психология)

## Описание

Telegram-бот на тему Метафорических Ассоциативных Карт (МАК) и психологии.
Выступает как онлайн-психолог-помощник. Написан на **Go**.

---

## Стек технологий

| Компонент       | Технология                            |
|-----------------|---------------------------------------|
| Бот (backend)   | Go + `go-telegram-bot-api`            |
| Mini App        | React + TypeScript + `@tma.js/sdk`    |
| База данных     | PostgreSQL + `pgx` / `sqlx`           |
| Миграции        | `golang-migrate`                      |
| Конфиг          | `.env` + `godotenv`                   |
| Деплой          | Docker + docker-compose               |

---

## Карта навигации бота

```
/start
    ↓
[Mini App: Опросник]  ←→  Пользователь может пропустить
    ↓
[Главное меню]
    ├── 🧠 ИИ Психолог-коуч
    │       ├── Сессия с ИИ (чат с GPT)
    │       ├── История сессий
    │       └── ← Назад в главное меню
    │
    ├── 📚 Обучение
    │       ├── Материалы по уровню (Новичок / Средний / Профи)
    │       ├── Курсы / уроки
    │       └── ← Назад в главное меню
    │
    ├── 📞 Контакты
    │       ├── Информация о специалистах
    │       ├── Запись на консультацию
    │       └── ← Назад в главное меню
    │
    └── 🛍 Магазин
            ├── Каталог (МАК-карты, материалы)
            ├── Корзина / оплата
            └── ← Назад в главное меню
```

---

## Структура папок проекта

```
mak_kart_allk_bot/
│
├── cmd/
│   └── bot/
│       └── main.go                  # Точка входа
│
├── internal/
│   ├── config/
│   │   └── config.go                # Загрузка .env
│   │
│   ├── db/
│   │   └── db.go                    # Подключение к PostgreSQL
│   │
│   ├── models/
│   │   ├── user.go                  # Профиль пользователя
│   │   ├── ai_session.go            # Сессии с ИИ
│   │   ├── order.go                 # Заказы (магазин)
│   │   └── education_progress.go    # Прогресс обучения
│   │
│   ├── repository/                  # Работа с БД (CRUD)
│   │   ├── user_repo.go
│   │   ├── session_repo.go
│   │   ├── order_repo.go
│   │   └── progress_repo.go
│   │
│   ├── services/                    # Бизнес-логика
│   │   ├── user_service.go
│   │   ├── quiz_service.go          # Логика опросника + определение уровня
│   │   ├── ai_service.go            # Интеграция с OpenAI GPT
│   │   └── shop_service.go
│   │
│   ├── handlers/                    # Обработчики команд и callback-ов
│   │   ├── start.go                 # /start, онбординг
│   │   ├── main_menu.go             # Главное меню
│   │   ├── ai_psychologist.go       # Ветка 1: ИИ-коуч
│   │   ├── education.go             # Ветка 2: Обучение
│   │   ├── contacts.go              # Ветка 3: Контакты
│   │   └── shop.go                  # Ветка 4: Магазин
│   │
│   ├── keyboards/                   # Inline и Reply клавиатуры
│   │   ├── main_menu.go
│   │   ├── ai_psychologist.go
│   │   ├── education.go
│   │   ├── contacts.go
│   │   └── shop.go
│   │
│   └── middleware/
│       └── user_middleware.go       # Автосоздание юзера при входе
│
├── migrations/                      # SQL-миграции (golang-migrate)
│   ├── 000001_create_users.up.sql
│   ├── 000001_create_users.down.sql
│   ├── 000002_create_ai_sessions.up.sql
│   ├── 000002_create_ai_sessions.down.sql
│   ├── 000003_create_orders.up.sql
│   ├── 000003_create_orders.down.sql
│   └── 000004_create_education_progress.up.sql
│   └── 000004_create_education_progress.down.sql
│
├── mini_app/                        # Frontend: React + TypeScript
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Onboarding/          # Опросник
│   │   │   └── Result/              # Результат уровня
│   │   ├── components/
│   │   ├── hooks/
│   │   └── App.tsx
│   └── package.json
│
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── go.mod
├── go.sum
└── PLAN.md                          # Этот файл
```

---

## Схема БД

### Таблица `users`
| Поле           | Тип         | Описание                        |
|----------------|-------------|---------------------------------|
| id             | SERIAL PK   |                                 |
| telegram_id    | BIGINT      | Уникальный ID Telegram          |
| username       | VARCHAR     | @username                       |
| full_name      | VARCHAR     | Имя пользователя                |
| level          | VARCHAR     | beginner / middle / pro         |
| quiz_answers   | JSONB       | Ответы на вопросы опросника     |
| quiz_skipped   | BOOLEAN     | Пропустил ли опросник           |
| created_at     | TIMESTAMP   |                                 |
| updated_at     | TIMESTAMP   |                                 |

### Таблица `ai_sessions`
| Поле       | Тип       | Описание                      |
|------------|-----------|-------------------------------|
| id         | SERIAL PK |                               |
| user_id    | INT FK    | → users.id                    |
| messages   | JSONB     | История диалога с ИИ          |
| created_at | TIMESTAMP |                               |
| updated_at | TIMESTAMP |                               |

### Таблица `education_progress`
| Поле              | Тип       | Описание              |
|-------------------|-----------|-----------------------|
| id                | SERIAL PK |                       |
| user_id           | INT FK    | → users.id            |
| course_id         | VARCHAR   |                       |
| completed_lessons | JSONB     | Список пройденных     |
| updated_at        | TIMESTAMP |                       |

### Таблица `orders`
| Поле       | Тип       | Описание                          |
|------------|-----------|-----------------------------------|
| id         | SERIAL PK |                                   |
| user_id    | INT FK    | → users.id                        |
| items      | JSONB     | Список товаров                    |
| total      | NUMERIC   | Итоговая сумма                    |
| status     | VARCHAR   | pending / paid / shipped          |
| created_at | TIMESTAMP |                                   |

---

## Этапы разработки

| Этап | Что делаем                                              | Статус  |
|------|---------------------------------------------------------|---------|
| 1    | Инфраструктура: go.mod, структура, docker, .env         | ✅ Done |
| 2    | Mini App (React) — Опросник + передача данных в бот     | ⬜      |
| 3    | Обработчик /start + главное меню                        | ⬜      |
| 4    | Ветка: ИИ Психолог-коуч (GPT интеграция)               | ⬜      |
| 5    | Ветка: Обучение                                         | ⬜      |
| 6    | Ветка: Контакты                                         | ⬜      |
| 7    | Ветка: Магазин                                          | ⬜      |

---

## Принцип навигации

- Каждая ветка содержит inline-кнопку **← Главное меню**
- Используется `FSM`-подход через `callback_data` для отслеживания состояний
- Данные пользователя сохраняются при каждом взаимодействии
