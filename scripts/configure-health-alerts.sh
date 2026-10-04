#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
CONFIG_DIR="/etc/4n-dev-core"
CONFIG_FILE="$CONFIG_DIR/monitoring.env"
REPORT="$APP_DIR/scripts/vps-health-report.sh"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

[ -x "$REPORT" ] || { echo "ERROR: health report script not executable: $REPORT"; exit 1; }

mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

if [ ! -f "$CONFIG_FILE" ]; then
  cat > "$CONFIG_FILE" <<'EOF'
# Optional health alert configuration.
# Set an email and install a working "mail" command to receive alerts.
HEALTH_ALERT_EMAIL=
HEALTH_ALERT_COOLDOWN=3600
EOF
  chmod 600 "$CONFIG_FILE"
fi

cat > /usr/local/sbin/4n-health-alert <<EOF
#!/bin/sh
set -u

APP_DIR='$APP_DIR'
CONFIG_FILE='$CONFIG_FILE'
REPORT="$APP_DIR/scripts/vps-health-report.sh"

[ -f "$CONFIG_FILE" ] && . "$CONFIG_FILE" || true

OUTPUT="$(mktemp)"
trap 'rm -f "$OUTPUT"' EXIT

if "$REPORT" > "$OUTPUT" 2>&1; then
  logger -t 4n-health-alert "VPS health check passed."
  exit 0
fi

MESSAGE="$(cat "$OUTPUT")"
logger -t 4n-health-alert "CRITICAL VPS health check failed."

if [ -n "${HEALTH_ALERT_EMAIL:-}" ] && command -v mail >/dev/null 2>&1; then
  printf '%s\n' "$MESSAGE" | mail -s "[4N DEV Core] VPS health alert" "$HEALTH_ALERT_EMAIL"
fi

exit 2
EOF

chmod 750 /usr/local/sbin/4n-health-alert

cat > /etc/systemd/system/4n-health-alert.service <<EOF
[Unit]
Description=4N DEV Core VPS health check and alert
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
EnvironmentFile=-$CONFIG_FILE
ExecStart=/usr/local/sbin/4n-health-alert
EOF

cat > /etc/systemd/system/4n-health-alert.timer <<'EOF'
[Unit]
Description=Run 4N DEV Core VPS health check every 15 minutes

[Timer]
OnBootSec=10min
OnUnitActiveSec=15min
Persistent=true
RandomizedDelaySec=2m

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now 4n-health-alert.timer

echo ""
echo "VPS health alerting configured."
echo "Configuration: $CONFIG_FILE"
echo "Check interval: 15 minutes"
echo ""
echo "Test with:"
echo "  systemctl start 4n-health-alert.service"
echo "  journalctl -u 4n-health-alert.service"
