#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
LOG_DIR="${LOG_DIR:-/var/log/4n-dev-core}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MAX_SIZE="${MAX_SIZE:-100M}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

case "$RETENTION_DAYS" in
  ''|*[!0-9]*) echo "ERROR: RETENTION_DAYS must be a number."; exit 1 ;;
esac

if [ "$RETENTION_DAYS" -lt 1 ]; then
  echo "ERROR: RETENTION_DAYS must be at least 1."
  exit 1
fi

echo "== 4N DEV Core production log management =="

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y logrotate

mkdir -p "$LOG_DIR"
chmod 750 "$LOG_DIR"

cat > /etc/logrotate.d/4n-dev-core <<EOF
$LOG_DIR/*.log {
    daily
    rotate $RETENTION_DAYS
    maxsize $MAX_SIZE
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF

mkdir -p /etc/systemd/journald.conf.d

cat > /etc/systemd/journald.conf.d/4n-dev-core.conf <<'EOF'
[Journal]
SystemMaxUse=500M
RuntimeMaxUse=200M
MaxRetentionSec=30day
Compress=yes
EOF

if command -v systemctl >/dev/null 2>&1; then
  systemctl restart systemd-journald
fi

if [ -d "$APP_DIR/logs" ]; then
  chmod 750 "$APP_DIR/logs"
fi

echo ""
echo "Log management configured."
echo "Application log directory: $LOG_DIR"
echo "Retention: $RETENTION_DAYS rotations"
echo "Maximum log file size: $MAX_SIZE"
echo "Journald disk limit: 500M"
echo "Journald runtime limit: 200M"
echo "Journald retention: 30 days"
echo ""
echo "Validate logrotate configuration with:"
echo "  logrotate -d /etc/logrotate.d/4n-dev-core"
