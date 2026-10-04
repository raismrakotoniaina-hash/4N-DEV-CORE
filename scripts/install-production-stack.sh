#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
DOMAIN="${1:-}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: APP_DIR=/opt/4n-dev-core ./scripts/install-production-stack.sh api.example.com"
  exit 1
fi

case "$DOMAIN" in
  *[!A-Za-z0-9.-]*|.*|*.) echo "ERROR: invalid domain: $DOMAIN"; exit 1 ;;
esac

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run this installer as root."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is not installed. Run bootstrap-production-server.sh first."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose plugin is unavailable."
  exit 1
fi

if [ ! -d "$APP_DIR/.git" ]; then
  echo "ERROR: repository not found at $APP_DIR."
  echo "Run bootstrap-production-server.sh first."
  exit 1
fi

cd "$APP_DIR"

if [ ! -f ".env" ]; then
  if [ ! -f ".env.docker.example" ]; then
    echo "ERROR: .env.docker.example not found."
    exit 1
  fi

  cp .env.docker.example .env
  chmod 600 .env
  echo "Created $APP_DIR/.env from template."
  echo "IMPORTANT: edit .env and replace every placeholder before continuing."
  exit 1
fi

chmod 600 .env

if [ -x "./scripts/validate-production-env.sh" ]; then
  ./scripts/validate-production-env.sh
else
  echo "ERROR: production environment validator is missing."
  exit 1
fi

if [ -x "./scripts/preflight-production.sh" ]; then
  ./scripts/preflight-production.sh "$DOMAIN"
else
  echo "ERROR: production preflight script is missing."
  exit 1
fi

mkdir -p nginx
sed "s/api\.your-domain\.example/$DOMAIN/g"   nginx/4n-core-bootstrap.conf.example   > nginx/4n-core.conf

chmod 644 nginx/4n-core.conf

echo ""
echo "Starting 4N DEV Core production stack..."
docker compose up -d --build

echo ""
echo "Waiting for Core readiness..."

attempt=1
while [ "$attempt" -le 30 ]; do
  if docker compose exec -T core node -e "fetch('http://127.0.0.1:3001/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
    echo "OK: Core readiness passed."
    break
  fi

  if [ "$attempt" -eq 30 ]; then
    echo "ERROR: Core did not become ready."
    docker compose ps
    docker compose logs --tail=100 core || true
    exit 1
  fi

  sleep 5
  attempt=$((attempt + 1))
done

docker compose ps

echo ""
echo "========================================"
echo "4N DEV CORE STACK INSTALLED"
echo "========================================"
echo "HTTP endpoint: http://$DOMAIN"
echo ""
echo "Next:"
echo "1. Point DNS $DOMAIN to this VPS."
echo "2. Run: ./scripts/enable-https.sh $DOMAIN admin@example.com"
echo "3. Verify: ./scripts/verify-production-https.sh $DOMAIN"
