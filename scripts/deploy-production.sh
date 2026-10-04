#!/bin/sh
set -eu

DOMAIN="${1:-}"
HEALTH_RETRIES="${HEALTH_RETRIES:-20}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: ./scripts/deploy-production.sh api.example.com"
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "ERROR: .env file not found."
  echo "Create .env from .env.docker.example and add real secrets first."
  exit 1
fi

if [ ! -f "docker-compose.yml" ]; then
  echo "ERROR: docker-compose.yml not found."
  exit 1
fi

if [ ! -f "nginx/4n-core-bootstrap.conf.example" ]; then
  echo "ERROR: NGINX bootstrap template not found."
  exit 1
fi

if [ ! -x "scripts/preflight-production.sh" ]; then
  chmod +x scripts/preflight-production.sh
fi

echo "Running production preflight..."
./scripts/preflight-production.sh "$DOMAIN"

mkdir -p nginx

sed "s/api\.your-domain\.example/$DOMAIN/g" \
  nginx/4n-core-bootstrap.conf.example \
  > nginx/4n-core.conf

echo "Starting 4N DEV Core production stack..."
docker compose up -d --build

echo "Waiting for the Core service to become ready..."

attempt=1
while [ "$attempt" -le "$HEALTH_RETRIES" ]; do
  if docker compose exec -T core node -e "fetch('http://127.0.0.1:3001/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
    echo "OK: Core readiness check passed."
    break
  fi

  if [ "$attempt" -eq "$HEALTH_RETRIES" ]; then
    echo "ERROR: Core did not become ready."
    echo ""
    echo "Recent Core logs:"
    docker compose logs --tail=80 core || true
    exit 1
  fi

  echo "Waiting... ($attempt/$HEALTH_RETRIES)"
  sleep 5
  attempt=$((attempt + 1))
done

if ! docker compose ps --status running | grep -q "nginx"; then
  echo "ERROR: NGINX is not running."
  docker compose ps
  exit 1
fi

if ! docker compose ps --status running | grep -q "postgres"; then
  echo "ERROR: PostgreSQL is not running."
  docker compose ps
  exit 1
fi

echo ""
echo "Production stack started and verified."
echo "API bootstrap URL: http://$DOMAIN"
echo ""
echo "Next step:"
echo "1. Point DNS for $DOMAIN to this VPS."
echo "2. Issue the Let's Encrypt certificate with Certbot."
echo "3. Switch nginx/4n-core.conf to the HTTPS configuration."
