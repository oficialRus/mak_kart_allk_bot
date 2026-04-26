# Деплой frontend в РФ, backend в Амстердаме

Эта инструкция для вашей схемы:

- `frontend` размещается на новом сервере в РФ
- `backend` продолжает работать на текущем сервере в Амстердаме
- frontend обращается к backend по HTTPS-домену API

## 1) Что должно быть заранее

- Домен frontend (пример: `app.garmonia-mak.ru`) указывает на IP сервера в РФ.
- Домен backend/API (пример: `api.garmonia-mak.ru`) указывает на сервер в Амстердаме.
- На обоих доменах есть валидный HTTPS-сертификат.

## 2) Настройка backend (Амстердам)

В `.env` backend проверьте:

```env
ALLOWED_ORIGINS=https://app.garmonia-mak.ru
APP_BASE_URL=https://app.garmonia-mak.ru
API_BASE_URL=https://api.garmonia-mak.ru
```

Если frontend-доменов несколько, укажите через запятую:

```env
ALLOWED_ORIGINS=https://app.garmonia-mak.ru,https://app2.garmonia-mak.ru
```

После изменения `.env` перезапустите backend-процесс.

## 3) Настройка frontend (РФ сервер)

В `frontend/mini_app` создайте файл `.env.production`:

```env
VITE_API_BASE_URL=https://api.garmonia-mak.ru
# По умолчанию используете Bearer session в JSON; cookie-режим не обязателен
VITE_AUTH_USE_HTTPONLY_COOKIE=0
```

Сборка frontend:

```bash
cd /path/to/frontend
./deploy-mini-app.sh
```

После сборки будут готовые файлы в:

`frontend/mini_app/dist`

## 4) Nginx на сервере frontend (РФ)

Раздавайте статику из `dist` и поддержите SPA-роутинг:

```nginx
server {
    listen 80;
    server_name app.garmonia-mak.ru;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.garmonia-mak.ru;

    # certbot/certs ...
    ssl_certificate     /etc/letsencrypt/live/app.garmonia-mak.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.garmonia-mak.ru/privkey.pem;

    root /var/www/app.garmonia-mak.ru;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Рекомендуется кэшировать статику со сборочными хешами
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }
}
```

Скопируйте `frontend/mini_app/dist/*` в `/var/www/app.garmonia-mak.ru`.

## 5) Проверка после выкладки

1. Откройте `https://app.garmonia-mak.ru`.
2. В DevTools -> Network проверьте, что запросы идут на `https://api.garmonia-mak.ru/api/...`.
3. Убедитесь, что `/api/auth/email/send-code` и `/api/auth/email/verify-code` возвращают 200/ожидаемые ответы.
4. Если видите CORS-ошибки — проверьте `ALLOWED_ORIGINS` на backend и перезапуск backend.

## 6) Типовые проблемы

- **Старый UI/иконки после деплоя**: очистите кэш браузера и переустановите PWA-ярлык.
- **CORS blocked**: frontend origin не добавлен в `ALLOWED_ORIGINS`.
- **Запросы уходят не на тот API**: нет/неверный `VITE_API_BASE_URL` при сборке.

