#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
HEALTH_RETRIES="${HEALTH_RETRIES:-24}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

if [ ! -d "$APP_DIR/.git" ]; then
  echo "ERROR: repository not found at $APP_DIR."
  exit 1
fi

cd "$APP_DIR"

echo "Checking current production state..."
docker compose ps || true

OLD_COMMIT="$(git rev-parse HEAD)"

echo "Current commit: $OLD_COMMIT"
echo "Fetching latest main..."
git fetch origin main

REMOTE_COMMIT="$(git rev-parse origin/main)"

if [ "$OLD_COMMIT" = "$REMOTE_COMMIT" ]; then
  echo "Already up to date."
  exit 0
fi

echo "Updating repository..."
git checkout main
git reset --hard origin/main

if [ ! -f ".env" ]; then
  echo "ERROR: .env is missing after update."
  git reset --hard "$OLD_COMMIT"
  exit 1
fi

chmod 600 .env

echo "Validating production environment..."
./scripts/validate-production-env.sh

echo "Validating production configuration..."
./scripts/preflight-production.sh "${DOMAIN:-api.example.com}"

echo "Rebuilding and restarting Core..."
docker compose up -d --build core

echo "Waiting for Core readiness..."
attempt=1
while [ "$attempt" -le "$HEALTH_RETRIES" ]; do
  if docker compose exec -T core node -e "fetch('http://127.0.0.1:3001/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
    echo "OK: new Core version is healthy."
    echo ""
    docker compose ps
    echo ""
    echo "Updated from:"
    echo "$OLD_COMMIT"
    echo "to:"
    echo "$REMOTE_COMMIT"
    exit 0
  fi

  sleep 5
  attempt=$((attempt + 1))
done

echo "ERROR: new Core version failed readiness."
echo ""
docker compose logs --tail=120 core || true

echo ""
echo "Rolling back application code to $OLD_COMMIT..."
git reset --hard "$OLD_COMMIT"

echo "Rebuilding previous Core version..."
docker compose up -d --build core

echo "Waiting for rollback readiness..."
attempt=1
while [ "$attempt" -le "$HEALTH_RETRIES" ]; do
  if docker compose exec -T core node -e "fetch('http://127.0.0.1:3001/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
    echo "ROLLBACK OK: previous Core version restored."
    exit 1
  fi

  sleep 5
  attempt=$((attempt + 1))
done

echo "CRITICAL: rollback version did not become healthy."
docker compose ps
exit 2
