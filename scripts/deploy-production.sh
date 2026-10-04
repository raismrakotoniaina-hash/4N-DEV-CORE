#!/bin/sh
set -eu

DOMAIN="${1:-}"

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

mkdir -p nginx

sed "s/api\.your-domain\.example/$DOMAIN/g" \
  nginx/4n-core-bootstrap.conf.example \
  > nginx/4n-core.conf

echo "Starting 4N DEV Core production stack..."
docker compose up -d --build

echo ""
echo "Production stack started."
echo "API bootstrap URL: http://$DOMAIN"
echo ""
echo "Next step:"
echo "1. Point DNS for $DOMAIN to this VPS."
echo "2. Issue the Let's Encrypt certificate with Certbot."
echo "3. Switch nginx/4n-core.conf from bootstrap HTTP to the HTTPS template."
