

set -e
cd "$(dirname "$0")"

echo "→ git pull..."
git pull

echo "→ go build..."
go build -o bin/bot ./cmd/bot

echo "→ systemctl restart mak-kart-bot.service..."
sudo systemctl restart mak-kart-bot.service

echo "✓ Готово. Бот перезапущен."
sudo systemctl status mak-kart-bot.service --no-pager -l
