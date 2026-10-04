#!/bin/sh
set -eu

cd "${COMPOSE_PROJECT_DIR:-$(dirname "$(dirname "$0")")}"

docker compose run --rm certbot renew --webroot -w /var/www/certbot --quiet
docker compose exec -T nginx nginx -s reload
