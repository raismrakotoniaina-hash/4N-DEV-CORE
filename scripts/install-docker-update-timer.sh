#!/bin/sh
set -eu

APP_DIR="${1:-/opt/4n-dev-core}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

SCRIPT="$APP_DIR/scripts/auto-update-docker-images.sh"

if [ ! -x "$SCRIPT" ]; then
  echo "ERROR: update script not found or not executable: $SCRIPT"
  echo "Run: chmod 750 $SCRIPT"
  exit 1
fi

cat > /etc/systemd/system/4n-docker-update.service <<EOF
[Unit]
Description=4N DEV Core controlled Docker image updates
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=$APP_DIR
ExecStart=$SCRIPT
EOF

cat > /etc/systemd/system/4n-docker-update.timer <<'EOF'
[Unit]
Description=Check 4N DEV Core Docker images weekly

[Timer]
OnCalendar=Sun *-*-* 04:30:00
Persistent=true
RandomizedDelaySec=30m

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now 4n-docker-update.timer

echo ""
echo "Docker automatic update timer installed."
echo "Schedule: weekly, Sunday around 04:30 with up to 30 minutes random delay."
echo ""
echo "Check with:"
echo "  systemctl status 4n-docker-update.timer"
echo "  journalctl -u 4n-docker-update.service"
