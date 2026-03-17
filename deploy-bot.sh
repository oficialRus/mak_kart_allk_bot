

set -e
cd "$(dirname "$0")"

echo "→ git pull..."
git pull

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
