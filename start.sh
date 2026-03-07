#!/bin/bash
set -e

echo "🧹 Nettoyage des anciens containers et volumes..."
docker compose down -v 2>/dev/null || true
docker stop $(docker ps -a -q) 2>/dev/null || true
docker rm $(docker ps -a -q) 2>/dev/null || true
docker volume prune -f 2>/dev/null || true

echo "🚀 Lancement du dashboard..."
docker compose up --build
