#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
INTERVAL="${DOCKER_MONITOR_INTERVAL:-1min}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

if [ ! -d "$APP_DIR" ]; then
  echo "ERROR: application directory not found: $APP_DIR"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is not installed."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose is not available."
  exit 1
fi

echo "== 4N DEV Core Docker health monitoring =="

cat > /usr/local/sbin/4n-docker-health-check <<EOF
#!/bin/sh
set -eu

APP_DIR='$APP_DIR'

cd "$APP_DIR"

if ! docker info >/dev/null 2>&1; then
  logger -t 4n-docker-monitor "Docker daemon is unavailable."
  exit 1
fi

services="$(docker compose config --services)"

for service in $services; do
  container="$(docker compose ps -q "$service" 2>/dev/null || true)"

  if [ -z "$container" ]; then
    logger -t 4n-docker-monitor "Service $service has no running container. Starting it."
    docker compose up -d "$service"
    continue
  fi

  state="$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || true)"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container" 2>/dev/null || true)"

  if [ "$state" != "running" ]; then
    logger -t 4n-docker-monitor "Service $service is $state. Restarting."
    docker compose restart "$service"
    continue
  fi

  case "$health" in
    unhealthy)
      logger -t 4n-docker-monitor "Service $service is unhealthy. Restarting."
      docker compose restart "$service"
      ;;
    starting)
      logger -t 4n-docker-monitor "Service $service health check is still starting."
      ;;
    healthy|no-healthcheck)
      ;;
    *)
      logger -t 4n-docker-monitor "Service $service has health state: $health"
      ;;
  esac
done
EOF

chmod 750 /usr/local/sbin/4n-docker-health-check

cat > /etc/systemd/system/4n-docker-health-monitor.service <<'EOF'
[Unit]
Description=4N DEV Core Docker container health monitor
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/4n-docker-health-check
EOF

cat > /etc/systemd/system/4n-docker-health-monitor.timer <<EOF
[Unit]
Description=Run 4N DEV Core Docker health monitor every $INTERVAL

[Timer]
OnBootSec=2min
OnUnitActiveSec=$INTERVAL
Persistent=true

[Install]
WantedBy=timers.target
EOF

if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload
  systemctl enable --now 4n-docker-health-monitor.timer
fi

echo ""
echo "Docker health monitoring configured."
echo "Application directory: $APP_DIR"
echo "Check interval: $INTERVAL"
echo ""
echo "The Compose healthchecks already defined in docker-compose.yml are used."
echo "Unhealthy or stopped services are restarted automatically."
echo ""
echo "Check with:"
echo "  systemctl status 4n-docker-health-monitor.timer"
echo "  journalctl -u 4n-docker-health-monitor.service"
