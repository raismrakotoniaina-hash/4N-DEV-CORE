#!/bin/sh
set -eu

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Usage: ./scripts/enable-https.sh api.example.com admin@example.com"
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "ERROR: .env file not found."
  exit 1
fi

if [ ! -f "nginx/4n-core-https.conf.example" ]; then
  echo "ERROR: HTTPS NGINX template not found."
  exit 1
fi

if ! docker compose ps --services --status running | grep -qx "nginx"; then
  echo "ERROR: NGINX container is not running."
  echo "Run ./scripts/deploy-production.sh $DOMAIN first."
  exit 1
fi

echo "Requesting Let's Encrypt certificate for $DOMAIN..."

docker compose run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  --keep-until-expiring \
  -d "$DOMAIN"

sed "s/api\.your-domain\.example/$DOMAIN/g" \
  nginx/4n-core-https.conf.example \
  > nginx/4n-core.conf

echo "Testing NGINX configuration..."
docker compose exec -T nginx nginx -t

echo "Reloading NGINX with HTTPS configuration..."
docker compose exec -T nginx nginx -s reload

echo ""
echo "HTTPS is enabled for: https://$DOMAIN"
echo ""
echo "Certificate renewal:"
echo "Run ./scripts/certbot-renew.sh periodically (recommended twice daily)."
