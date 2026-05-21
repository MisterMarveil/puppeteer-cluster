#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/marveil/puppeteer-cluster"
PROJECT_NAME="puppeteer-cluster"

cd "$APP_DIR"

echo "=== Arrêt propre du cluster Puppeteer ==="
docker compose -p "$PROJECT_NAME" down --remove-orphans

echo "=== Suppression éventuelle d'anciens conteneurs nommés ==="
docker rm -f puppeteer-lb 2>/dev/null || true
docker rm -f puppeteer-1 puppeteer-2 puppeteer-3 puppeteer-4 puppeteer-5 puppeteer-6 puppeteer-7 2>/dev/null || true

echo "=== Suppression éventuelle de l'ancien réseau Puppeteer ==="
docker network rm "${PROJECT_NAME}_puppeteer_net" 2>/dev/null || true

echo "=== Reconstruction et démarrage du cluster ==="
docker compose -p "$PROJECT_NAME" up -d --build --force-recreate --remove-orphans

echo "=== État des conteneurs ==="
docker compose -p "$PROJECT_NAME" ps

echo "=== Test du load balancer ==="
sleep 3
docker exec puppeteer-lb wget -T 5 -O- http://127.0.0.1/health || true

echo ""
echo "=== Test des workers depuis puppeteer-lb ==="
docker exec puppeteer-lb sh -c '
for i in 1 2 3 4 5 6 7; do
  echo "Testing puppeteer-$i..."
  wget -T 5 -O- http://puppeteer-$i:3005/health || echo "FAILED puppeteer-$i"
  echo ""
done
'