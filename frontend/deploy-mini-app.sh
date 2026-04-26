#!/bin/bash
# Сборка mini_app на frontend-сервере.
# Запускать из папки frontend: ./deploy-mini-app.sh
#
# 1. Соберёт mini_app в папку mini_app/dist/
# 2. Далее скопируйте dist в каталог, который раздаёт ваш nginx

set -e
cd "$(dirname "$0")"

echo "→ npm install в mini_app..."
cd mini_app
npm ci --prefer-offline --no-audit 2>/dev/null || npm install

echo "→ npm run build..."
npm run build

echo "✓ Сборка готова: mini_app/dist/"
echo "✓ Дальше выложите содержимое mini_app/dist в web-root вашего nginx."
