#!/bin/sh
set -eu

ENV_FILE="${ENV_FILE:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  exit 1
fi

echo "Validating production environment: $ENV_FILE"

required_vars="
POSTGRES_PASSWORD
CORE_API_KEY
CORE_ADMIN_SECRET
"

for var in $required_vars; do
  value=$(grep -E "^$var=" "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- || true)

  if [ -z "$value" ]; then
    echo "ERROR: $var is missing or empty."
    exit 1
  fi

  case "$value" in
    *replace-with*|*your-domain.example*|*your-openai-api-key*|*your-papi-api-key*|*your-papi-webhook-secret*)
      echo "ERROR: $var still contains a placeholder."
      exit 1
      ;;
  esac
done

mode=$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE")
if [ "$mode" != "600" ]; then
  echo "ERROR: $ENV_FILE permissions must be 600 (current: $mode)."
  echo "Fix with: chmod 600 $ENV_FILE"
  exit 1
fi

echo "OK: required production secrets are present and not placeholders."
echo "OK: environment file permissions are 600."
