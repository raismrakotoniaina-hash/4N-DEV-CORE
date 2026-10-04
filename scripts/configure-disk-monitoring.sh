#!/bin/sh
set -eu

THRESHOLD="${DISK_USAGE_THRESHOLD:-80}"
CRITICAL_THRESHOLD="${DISK_CRITICAL_THRESHOLD:-90}"
ALERT_EMAIL="${DISK_ALERT_EMAIL:-}"
CHECK_PATH="${DISK_CHECK_PATH:-/}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

case "$THRESHOLD" in ''|*[!0-9]*) echo "ERROR: DISK_USAGE_THRESHOLD must be a number."; exit 1 ;; esac
case "$CRITICAL_THRESHOLD" in ''|*[!0-9]*) echo "ERROR: DISK_CRITICAL_THRESHOLD must be a number."; exit 1 ;; esac

if [ "$THRESHOLD" -lt 1 ] || [ "$THRESHOLD" -gt 99 ] || [ "$CRITICAL_THRESHOLD" -lt 1 ] || [ "$CRITICAL_THRESHOLD" -gt 100 ] || [ "$THRESHOLD" -ge "$CRITICAL_THRESHOLD" ]; then
  echo "ERROR: thresholds must satisfy 1 <= warning < critical <= 100."
  exit 1
fi

if [ ! -d "$CHECK_PATH" ]; then
  echo "ERROR: disk check path does not exist: $CHECK_PATH"
  exit 1
fi

echo "== 4N DEV Core VPS disk monitoring =="

cat > /usr/local/sbin/4n-disk-check <<EOF
#!/bin/sh
set -eu

THRESHOLD=$THRESHOLD
CRITICAL_THRESHOLD=$CRITICAL_THRESHOLD
CHECK_PATH='$CHECK_PATH'
ALERT_EMAIL='$ALERT_EMAIL'

USAGE="$(df -P "$CHECK_PATH" | awk 'NR==2 {gsub("%","",$5); print $5}')"
MOUNT="$(df -P "$CHECK_PATH" | awk 'NR==2 {print $6}')"
HOST="$(hostname)"

if [ -z "$USAGE" ]; then
  logger -t 4n-disk-monitor "ERROR: unable to determine disk usage for $CHECK_PATH"
  exit 1
fi

MESSAGE=""
LEVEL="OK"

if [ "$USAGE" -ge "$CRITICAL_THRESHOLD" ]; then
  LEVEL="CRITICAL"
  MESSAGE="CRITICAL: $HOST disk usage is ${USAGE}% on $MOUNT."
elif [ "$USAGE" -ge "$THRESHOLD" ]; then
  LEVEL="WARNING"
  MESSAGE="WARNING: $HOST disk usage is ${USAGE}% on $MOUNT."
fi

if [ "$LEVEL" = "OK" ]; then
  logger -t 4n-disk-monitor "OK: disk usage is ${USAGE}% on $MOUNT."
  exit 0
fi

logger -t 4n-disk-monitor "$MESSAGE"

if [ -n "$ALERT_EMAIL" ] && command -v mail >/dev/null 2>&1; then
  printf '%s\n' "$MESSAGE" | mail -s "[4N DEV Core] $LEVEL disk alert" "$ALERT_EMAIL"
fi

if [ "$LEVEL" = "CRITICAL" ]; then
  exit 2
fi

exit 1
EOF

chmod 750 /usr/local/sbin/4n-disk-check

cat > /etc/systemd/system/4n-disk-monitor.service <<'EOF'
[Unit]
Description=4N DEV Core VPS disk space check
After=local-fs.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/4n-disk-check
EOF

cat > /etc/systemd/system/4n-disk-monitor.timer <<'EOF'
[Unit]
Description=Run 4N DEV Core VPS disk space check every 15 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=15min
Persistent=true

[Install]
WantedBy=timers.target
EOF

if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload
  systemctl enable --now 4n-disk-monitor.timer
fi

echo ""
echo "Disk monitoring configured."
echo "Warning threshold: $THRESHOLD%"
echo "Critical threshold: $CRITICAL_THRESHOLD%"
echo "Checked path: $CHECK_PATH"
if [ -n "$ALERT_EMAIL" ]; then
  echo "Email alerts: $ALERT_EMAIL (only if the 'mail' command is installed)"
else
  echo "Email alerts: not configured; alerts are written to the system journal."
fi
echo ""
echo "Check status with:"
echo "  systemctl status 4n-disk-monitor.timer"
echo "  journalctl -u 4n-disk-monitor.service"
