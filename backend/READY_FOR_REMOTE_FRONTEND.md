# Backend readiness for remote frontend

Этот файл готовит backend (Амстердам) к приёму запросов от frontend на отдельном сервере (РФ).

## 1. Обязательные переменные в `backend/.env`

```env
# Где размещён frontend (РФ)
APP_BASE_URL=https://app.garmonia-mak.ru

# Где размещён backend/API (Амстердам)
API_BASE_URL=https://api.garmonia-mak.ru

# CORS: разрешённые frontend-origin (без завершающего /)
ALLOWED_ORIGINS=https://app.garmonia-mak.ru
```

Если frontend-доменов несколько:

```env
ALLOWED_ORIGINS=https://app.garmonia-mak.ru,https://app2.garmonia-mak.ru
```

## 2. Проверка после разделения репозитория

После переноса в `backend/` загрузка `.env` уже поддерживает запуск из:

- `backend/`
- `backend/cmd/api`
- `backend/cmd/bot`

## 3. Запуск API

Из `backend/`:

```bash
go run ./cmd/api
```

Или через ваш systemd-сервис.

## 4. Проверка CORS

Проверьте preflight:

```bash
curl -i -X OPTIONS "https://api.garmonia-mak.ru/api/daily-number" \
  -H "Origin: https://app.garmonia-mak.ru" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization"
```

В ответе должны быть:

- `Access-Control-Allow-Origin: https://app.garmonia-mak.ru`
- `Access-Control-Allow-Methods: POST, GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token`

## 5. Что важно на frontend

На frontend-сборке должен быть:

```env
VITE_API_BASE_URL=https://api.garmonia-mak.ru
```

Иначе frontend продолжит ходить на неверный URL.

