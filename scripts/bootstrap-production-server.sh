#!/bin/sh
set -eu

REPO_URL="${REPO_URL:-https://github.com/raismrakotoniaina-hash/4N-DEV-CORE.git}"
APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
BRANCH="${BRANCH:-main}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run this script as root."
  exit 1
fi

echo "== 4N DEV Core production server bootstrap =="

if [ -f /etc/os-release ]; then
  . /etc/os-release
else
  echo "ERROR: /etc/os-release not found."
  exit 1
fi

case "${ID:-}" in
  ubuntu|debian) ;;
  *)
    echo "ERROR: supported OS: Ubuntu or Debian."
    echo "Detected: ${ID:-unknown}"
    exit 1
    ;;
esac

echo "Detected OS: $PRETTY_NAME"

export DEBIAN_FRONTEND=noninteractive

echo "Updating system packages..."
apt-get update
apt-get install -y ca-certificates curl git openssl awscli

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker Engine..."
  curl -fsSL https://get.docker.com | sh
fi

systemctl enable --now docker

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose plugin is not available."
  exit 1
fi

echo "Docker: $(docker --version)"
echo "Compose: $(docker compose version)"

if [ ! -d "$APP_DIR/.git" ]; then
  echo "Cloning 4N DEV Core..."
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$APP_DIR"
else
  echo "Repository already exists. Updating..."
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
fi

cd "$APP_DIR"

mkdir -p backups/postgres
chmod 700 backups backups/postgres

if [ ! -f ".env" ]; then
  if [ ! -f ".env.docker.example" ]; then
    echo "ERROR: .env.docker.example not found."
    exit 1
  fi

  cp .env.docker.example .env
  chmod 600 .env

  echo ""
  echo "IMPORTANT: .env was created from .env.docker.example."
  echo "Edit $APP_DIR/.env and replace ALL placeholders with real production secrets."
  echo "Do not start production services until .env is configured."
else
  chmod 600 .env
  echo ".env already exists; leaving it unchanged."
fi

echo ""
echo "Installing systemd timers..."

for unit in \
  deploy/systemd/4n-certbot-renew.service \
  deploy/systemd/4n-certbot-renew.timer \
  deploy/systemd/4n-postgres-backup.service \
  deploy/systemd/4n-postgres-backup.timer
do
  if [ ! -f "$unit" ]; then
    echo "ERROR: missing $unit"
    exit 1
  fi
done

install -m 644 deploy/systemd/4n-certbot-renew.service /etc/systemd/system/4n-certbot-renew.service
install -m 644 deploy/systemd/4n-certbot-renew.timer /etc/systemd/system/4n-certbot-renew.timer
install -m 644 deploy/systemd/4n-postgres-backup.service /etc/systemd/system/4n-postgres-backup.service
install -m 644 deploy/systemd/4n-postgres-backup.timer /etc/systemd/system/4n-postgres-backup.timer

systemctl daemon-reload

echo ""
echo "Bootstrap completed."
echo ""
echo "Next steps:"
echo "1. Configure production secrets in $APP_DIR/.env"
echo "2. Configure S3_BUCKET and AWS credentials for external backups"
echo "3. Point DNS to this VPS"
echo "4. Run: cd $APP_DIR && ./scripts/deploy-production.sh api.your-domain.example"
echo "5. Issue HTTPS with: ./scripts/enable-https.sh api.your-domain.example admin@example.com"
echo "6. Enable timers after configuration:"
echo "   systemctl enable --now 4n-certbot-renew.timer"
echo "   systemctl enable --now 4n-postgres-backup.timer"
