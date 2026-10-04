#!/bin/sh
set -eu

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Usage: ./scripts/verify-production-https.sh api.example.com admin@example.com"
  exit 1
fi

case "$DOMAIN" in
  *[!A-Za-z0-9.-]*|.*|*.|*..*)
    echo "ERROR: invalid domain format: $DOMAIN"
    exit 1
    ;;
esac

command -v curl >/dev/null 2>&1 || { echo "ERROR: curl is required."; exit 1; }

echo "Checking HTTPS endpoint: https://$DOMAIN/health/ready"
headers="$(mktemp)"
body="$(mktemp)"
cleanup() { rm -f "$headers" "$body"; }
trap cleanup EXIT INT TERM

http_code="$(curl -sS -L --max-time 15 -D "$headers" -o "$body" -w '%{http_code}' "https://$DOMAIN/health/ready")"

[ "$http_code" = "200" ] || {
  echo "ERROR: readiness endpoint returned HTTP $http_code."
  cat "$body"
  exit 1
}

grep -qi '^strict-transport-security:' "$headers" || {
  echo "ERROR: HSTS header is missing."
  exit 1
}

grep -qi '^x-content-type-options: nosniff' "$headers" || {
  echo "ERROR: X-Content-Type-Options header is missing."
  exit 1
}

grep -qi '^referrer-policy:' "$headers" || {
  echo "ERROR: Referrer-Policy header is missing."
  exit 1
}

echo "OK: HTTPS endpoint, readiness, and security headers verified."
echo "Production HTTPS verification PASSED."
