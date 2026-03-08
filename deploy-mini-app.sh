#!/bin/bash
# Сборка и выкладка мини-приложения (app.garmonia-mak.ru).
# Запускать из корня проекта: ./deploy-mini-app.sh
#
# 1. Соберёт mini_app в папку mini_app/dist/
# 2. На этом сервере nginx уже смотрит в mini_app/dist — копировать никуда не нужно

set -e
cd "$(dirname "$0")"

echo "→ npm install в mini_app..."
cd mini_app
npm ci --prefer-offline --no-audit 2>/dev/null || npm install

echo "→ npm run build..."
npm run build

echo "✓ Сборка готова: mini_app/dist/"
echo "✓ Nginx на этом сервере отдаёт app.garmonia-mak.ru из этой же папки — сайт уже обновлён."
