#!/bin/bash
set -e

SRC=~/navidrome
COMPOSE=/mnt/ha-shared/navidrome
IMAGE="jgmelon:5002/navidrome:social"

cd "$SRC"
git pull
echo "🔨 Building navidrome..."
docker build -t "$IMAGE" . > /dev/null 2>&1
echo "🚀 Pushing navidrome to registry..."
docker push "$IMAGE" > /dev/null 2>&1

cd "$COMPOSE"
docker compose pull navidrome > /dev/null 2>&1
docker compose stop navidrome > /dev/null 2>&1
echo "💾 Backing up database..."
cp /var/lib/navidrome/navidrome.db "backups/navidrome-$(date +%F-%H%M).db"
docker compose up -d navidrome > /dev/null 2>&1
echo "✅ navidrome deployed successfully"
