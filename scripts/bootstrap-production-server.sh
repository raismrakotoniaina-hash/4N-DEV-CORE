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

if [ -f /etc/os-release ]; then . /etc/os-release; else echo "ERROR: /etc/os-release not found."; exit 1; fi

case "${ID:-}" in
  ubuntu|debian) ;;
  *) echo "ERROR: supported OS: Ubuntu or Debian. Detected: ${ID:-unknown}"; exit 1 ;;
esac

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git openssl

if ! command -v aws >/dev/null 2>&1; then
  if apt-cache show awscli >/dev/null 2>&1; then
    apt-get install -y awscli
  else
    echo "WARNING: awscli is not available from the configured APT repositories."
    echo "Install AWS CLI v2 separately before enabling external backup uploads."
  fi
fi

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

systemctl enable --now docker

docker compose version >/dev/null 2>&1 || {
  echo "ERROR: Docker Compose plugin is not available."
  exit 1
}

if [ ! -d "$APP_DIR/.git" ]; then
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
fi

cd "$APP_DIR"
mkdir -p backups/postgres
chmod 700 backups backups/postgres

if [ ! -f ".env" ]; then
  cp .env.docker.example .env
  chmod 600 .env
  echo "IMPORTANT: configure $APP_DIR/.env before starting production."
else
  chmod 600 .env
fi

for unit in \
  deploy/systemd/4n-certbot-renew.service \
  deploy/systemd/4n-certbot-renew.timer \
  deploy/systemd/4n-postgres-backup.service \
  deploy/systemd/4n-postgres-backup.timer
do
  [ -f "$unit" ] || { echo "ERROR: missing $unit"; exit 1; }
done

install -m 644 deploy/systemd/4n-certbot-renew.service /etc/systemd/system/4n-certbot-renew.service
install -m 644 deploy/systemd/4n-certbot-renew.timer /etc/systemd/system/4n-certbot-renew.timer
install -m 644 deploy/systemd/4n-postgres-backup.service /etc/systemd/system/4n-postgres-backup.service
install -m 644 deploy/systemd/4n-postgres-backup.timer /etc/systemd/system/4n-postgres-backup.timer

systemctl daemon-reload

echo ""
echo "Bootstrap completed."
echo "Run the preflight check before production:"
echo "  cd $APP_DIR && ./scripts/preflight-production.sh"
