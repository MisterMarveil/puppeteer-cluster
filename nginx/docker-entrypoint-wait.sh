#!/bin/sh
set -e

echo "Waiting for puppeteer workers to be ready..."
until wget -q -O- http://puppeteer-1:3005/health > /dev/null 2>&1; do
  echo "Waiting for puppeteer-1..."
  sleep 2
done

echo "All workers ready, starting Nginx..."
exec /docker-entrypoint.sh nginx -g "daemon off;"