#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
SYSTEMD_DIR="$APP_DIR/deploy/systemd"
TARGET_DIR="/etc/systemd/system"
CONFIG_DIR="/etc/4n-dev-core"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

if [ ! -d "$SYSTEMD_DIR" ]; then
  echo "ERROR: systemd deployment directory not found: $SYSTEMD_DIR"
  exit 1
fi

mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

install_unit() {
  name="$1"
  if [ ! -f "$SYSTEMD_DIR/$name" ]; then
    echo "ERROR: missing unit: $SYSTEMD_DIR/$name"
    exit 1
  fi
  install -m 0644 "$SYSTEMD_DIR/$name" "$TARGET_DIR/$name"
}

echo "Installing 4N DEV Core production services and timers..."

for unit in   4n-production-update.service   4n-production-update.timer   4n-production-alert.service   4n-production-alert.timer   4n-production-audit.service   4n-production-audit.timer   4n-certbot-renew.service   4n-certbot-renew.timer   4n-postgres-backup.service   4n-postgres-backup.timer   4n-backup-monitor.service   4n-backup-monitor.timer   4n-disk-monitor.service   4n-disk-monitor.timer   4n-docker-health-monitor.service   4n-docker-health-monitor.timer   4n-docker-update.service   4n-docker-update.timer
do
  install_unit "$unit"
done

if [ ! -f "$CONFIG_DIR/update.env" ]; then
  cat > "$CONFIG_DIR/update.env" <<'EOF'
# Optional production update settings
# DOMAIN=api.example.com
# HEALTH_RETRIES=24
EOF
  chmod 600 "$CONFIG_DIR/update.env"
fi

if [ ! -f "$CONFIG_DIR/monitoring.env" ]; then
  cat > "$CONFIG_DIR/monitoring.env" <<'EOF'
# Optional production monitoring settings
# HEALTH_ALERT_EMAIL=
# HEALTH_ALERT_COOLDOWN=3600
EOF
  chmod 600 "$CONFIG_DIR/monitoring.env"
fi

systemctl daemon-reload

for timer in   4n-production-update.timer   4n-production-alert.timer   4n-production-audit.timer   4n-certbot-renew.timer   4n-postgres-backup.timer   4n-backup-monitor.timer   4n-disk-monitor.timer   4n-docker-health-monitor.timer   4n-docker-update.timer
do
  systemctl enable --now "$timer"
done

echo ""
echo "Production automation installed and enabled."
echo ""
systemctl list-timers --all | grep -E '4n-(production-update|production-alert|production-audit|certbot-renew|postgres-backup|backup-monitor|disk-monitor|docker-health-monitor|docker-update)' || true
