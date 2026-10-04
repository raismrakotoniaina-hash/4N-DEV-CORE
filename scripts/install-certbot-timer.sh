#!/bin/sh
set -eu

APP_DIR="${1:-/opt/4n-dev-core}"

if [ ! -d "$APP_DIR" ]; then
  echo "ERROR: application directory not found: $APP_DIR"
  exit 1
fi

SERVICE_SRC="$APP_DIR/deploy/systemd/4n-certbot-renew.service"
TIMER_SRC="$APP_DIR/deploy/systemd/4n-certbot-renew.timer"

if [ ! -f "$SERVICE_SRC" ] || [ ! -f "$TIMER_SRC" ]; then
  echo "ERROR: systemd unit files not found."
  exit 1
fi

install -m 644 "$SERVICE_SRC" /etc/systemd/system/4n-certbot-renew.service
install -m 644 "$TIMER_SRC" /etc/systemd/system/4n-certbot-renew.timer

systemctl daemon-reload
systemctl enable --now 4n-certbot-renew.timer

echo ""
echo "Certbot automatic renewal timer enabled."
echo "Check with: systemctl status 4n-certbot-renew.timer"
