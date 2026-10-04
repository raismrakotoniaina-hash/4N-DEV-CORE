#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
SERVICES="${DOCKER_UPDATE_SERVICES:-postgres nginx certbot}"
HEALTH_WAIT="${DOCKER_UPDATE_HEALTH_WAIT:-120}"
LOG_TAG="4n-docker-update"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

cd "$APP_DIR"

command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker is not installed."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "ERROR: Docker Compose is unavailable."; exit 1; }

logger -t "$LOG_TAG" "Starting Docker image update check."

# Create a database backup before changing the PostgreSQL image.
case " $SERVICES " in
  *" postgres "*)
    if [ -x "$APP_DIR/scripts/backup-postgres.sh" ]; then
      "$APP_DIR/scripts/backup-postgres.sh"
    else
      logger -t "$LOG_TAG" "WARNING: PostgreSQL backup script not found; continuing without image update."
      echo "ERROR: PostgreSQL backup script is required before updating postgres."
      exit 1
    fi
    ;;
esac

for service in $SERVICES; do
  old_image="$(docker compose ps -q "$service" 2>/dev/null | xargs -r docker inspect -f '{{.Image}}' 2>/dev/null || true)"

  if [ -z "$old_image" ]; then
    logger -t "$LOG_TAG" "$service has no existing container; skipping automatic update."
    continue
  fi

  old_ref="$(docker inspect -f '{{.Config.Image}}' "$old_image" 2>/dev/null || true)"
  logger -t "$LOG_TAG" "Checking $service ($old_ref)."

  docker compose pull "$service"

  new_image="$(docker image inspect "$old_ref" -f '{{.Id}}' 2>/dev/null || true)"
  if [ -n "$new_image" ] && [ "$new_image" = "$old_image" ]; then
    logger -t "$LOG_TAG" "$service is already up to date."
    continue
  fi

  logger -t "$LOG_TAG" "Updating $service."

  docker compose up -d --no-deps "$service"

  healthy=0
  elapsed=0

  while [ "$elapsed" -lt "$HEALTH_WAIT" ]; do
    container="$(docker compose ps -q "$service" 2>/dev/null || true)"
    if [ -n "$container" ]; then
      state="$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || true)"
      health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container" 2>/dev/null || true)"

      if [ "$state" = "running" ] && { [ "$health" = "healthy" ] || [ "$health" = "no-healthcheck" ]; }; then
        healthy=1
        break
      fi
    fi

    sleep 5
    elapsed=$((elapsed + 5))
  done

  if [ "$healthy" -eq 1 ]; then
    logger -t "$LOG_TAG" "$service update passed health check."
  else
    logger -t "$LOG_TAG" "ERROR: $service failed health check after update."

    # Restore the exact image used before the update.
    current_container="$(docker compose ps -q "$service" 2>/dev/null || true)"
    current_ref="$(docker inspect -f '{{.Config.Image}}' "$current_container" 2>/dev/null || true)"

    docker compose stop "$service" || true
    docker compose rm -f "$service" || true

    if [ -n "$old_ref" ] && [ -n "$old_image" ]; then
      docker tag "$old_image" "$old_ref"
      docker compose up -d --no-deps "$service"
    fi

    logger -t "$LOG_TAG" "Rollback attempted for $service."
    exit 1
  fi
done

logger -t "$LOG_TAG" "Docker image update check completed successfully."
