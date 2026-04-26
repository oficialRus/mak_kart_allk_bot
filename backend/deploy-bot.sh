#!/usr/bin/env bash

set -euo pipefail
cd "$(dirname "$0")"

has_env_value() {
  local pattern="$1"
  local file="$2"
  if command -v rg >/dev/null 2>&1; then
    rg -q "$pattern" "$file"
  else
    grep -Eq "$pattern" "$file"
  fi
}

echo "→ git pull..."
if [ "${UPDATE_FROM_GIT:-0}" = "1" ]; then
  echo "→ UPDATE_FROM_GIT=1: выполняем git pull..."
  git pull
else
  echo "→ UPDATE_FROM_GIT не задан: пропускаем git pull и деплоим текущий локальный код"
fi

echo "→ проверяем .env..."
if [ ! -f ".env" ]; then
  echo "✗ .env не найден в корне проекта"
  exit 1
fi
if ! has_env_value '^EMAIL_OTP_SECRET=.+$' ".env"; then
  echo "✗ EMAIL_OTP_SECRET не задан в .env (после этапа 6 запуск должен быть заблокирован)"
  exit 1
fi

if has_env_value '^AUTH_MODE=email_only$' ".env"; then
  echo "ℹ AUTH_MODE=email_only: bot polling будет отключён самим приложением"
fi

echo "→ go build bot..."
go build -o bin/bot ./cmd/bot

echo "→ останавливаем сервис бота..."
sudo systemctl stop mak-kart-bot.service || true
sleep 2
echo "→ завершаем все процессы бота (чтобы не было конфликта getUpdates)..."
BOT_BIN="$(pwd)/bin/bot"
# Убиваем по полному пути и по относительному (./bin/bot), т.к. ручной запуск даёт другой argv
sudo pkill -f "$BOT_BIN" 2>/dev/null || true
sudo pkill -f "./bin/bot" 2>/dev/null || true
# На всякий случай: все, у кого исполняемый файл — наш bin/bot
for pid in $(pgrep -f "bin/bot" 2>/dev/null); do
  [ "$(readlink -f /proc/$pid/exe 2>/dev/null)" = "$BOT_BIN" ] && sudo kill "$pid" 2>/dev/null || true
done
sleep 2
echo "→ запускаем бота..."
sudo systemctl start mak-kart-bot.service
sleep 1
echo ""
echo "✓ Готово. Проверка: должен быть только один процесс."
pgrep -af "bin/bot" || true
echo ""
sudo systemctl status mak-kart-bot.service --no-pager -l
