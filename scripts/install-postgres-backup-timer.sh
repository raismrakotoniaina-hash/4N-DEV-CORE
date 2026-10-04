#!/bin/sh
set -eu

APP_DIR="${1:-/opt/4n-dev-core}"

SERVICE_SRC="$APP_DIR/deploy/systemd/4n-postgres-backup.service"
TIMER_SRC="$APP_DIR/deploy/systemd/4n-postgres-backup.timer"

if [ ! -f "$SERVICE_SRC" ] || [ ! -f "$TIMER_SRC" ]; then
  echo "ERROR: backup systemd unit files not found."
  exit 1
fi

install -m 644 "$SERVICE_SRC" /etc/systemd/system/4n-postgres-backup.service
install -m 644 "$TIMER_SRC" /etc/systemd/system/4n-postgres-backup.timer

systemctl daemon-reload
systemctl enable --now 4n-postgres-backup.timer

echo ""
echo "PostgreSQL backup timer enabled."
echo "Check with: systemctl status 4n-postgres-backup.timer"
