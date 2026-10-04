#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
CONFIG_DIR="/etc/4n-dev-core"
CONFIG_FILE="$CONFIG_DIR/backup.env"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

[ -d "$APP_DIR" ] || { echo "ERROR: app directory not found: $APP_DIR"; exit 1; }
[ -f "$APP_DIR/deploy/systemd/4n-postgres-backup.env.example" ] || {
  echo "ERROR: backup environment template not found."
  exit 1
}

mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

if [ ! -f "$CONFIG_FILE" ]; then
  cp "$APP_DIR/deploy/systemd/4n-postgres-backup.env.example" "$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE"
  echo "Created $CONFIG_FILE"
  echo "Edit it and replace every placeholder with real backup credentials."
else
  chmod 600 "$CONFIG_FILE"
  echo "$CONFIG_FILE already exists; permissions set to 600."
fi

install -m 644 "$APP_DIR/deploy/systemd/4n-postgres-backup.service" /etc/systemd/system/4n-postgres-backup.service
install -m 644 "$APP_DIR/deploy/systemd/4n-postgres-backup.timer" /etc/systemd/system/4n-postgres-backup.timer

systemctl daemon-reload

echo ""
echo "External backup configuration prepared."
echo ""
echo "Next:"
echo "1. Edit $CONFIG_FILE"
echo "2. Set S3_BUCKET and backup credentials."
echo "3. For S3-compatible storage, set AWS_ENDPOINT_URL."
echo "4. Test the backup manually:"
echo "   systemctl start 4n-postgres-backup.service"
echo "5. Check the result:"
echo "   systemctl status 4n-postgres-backup.service"
echo "   journalctl -u 4n-postgres-backup.service"
