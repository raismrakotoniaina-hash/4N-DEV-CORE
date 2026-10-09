# 4N DEV Core — VPS deployment audit

Audit date: 2026-10-09
Scope: repository preparation for a future Contabo Cloud VPS 4 deployment.
This document records repository evidence only; it does not claim that a VPS has been purchased or configured.

## Repository preparation present

- `Dockerfile` builds the Node.js API container.
- `docker-compose.yml` defines Core API, PostgreSQL, Nginx and Certbot services.
- PostgreSQL is not published as a host port; it is exposed only inside the Compose network.
- Core API has a readiness endpoint at `/health/ready`; Compose uses it as the Core health check.
- `scripts/backup-postgres.sh` creates compressed PostgreSQL dumps, applies local retention, and supports an optional rclone off-site copy when configured.
- `scripts/install-backup-cron.sh` installs a daily 02:30 server-time backup schedule.
- Custom-domain mapping and DNS TXT ownership verification API are implemented; see docs/DOMAIN-HOSTING.md. Custom-domain serving remains disabled by default.
- `.env.example` documents the Compose PostgreSQL password and the main Core configuration variables.
- `.gitignore` excludes local secrets and backup artifacts.
- `.dockerignore` already excludes environment files and runtime data.
- `nginx/default.conf` now provides the initial HTTP reverse proxy and ACME challenge path.
- The Docker image now copies `frontend/`, required because the API serves its developer console from that directory.

## Remaining before production

1. Purchase/create the VPS and confirm the selected Ubuntu LTS image.
2. Configure a non-root administrator, SSH access, firewall and security updates.
3. Create the server-side `.env` using strong unique secrets; never commit it.
4. Choose/register the main 4N DEV domain, confirm DNS ownership, and point the intended hostname(s) at the VPS. The API can attach customer-owned domains, but automatic registrar purchase is not implemented.
5. Issue Let's Encrypt certificates and configure HTTPS Nginx routing for the Core hostname and customer domains. The current Nginx file is HTTP-only bootstrap configuration; customer-domain certificate automation remains outstanding.
6. Configure certificate renewal and a safe Nginx reload after renewal.
7. Deploy with Docker Compose and verify the Core, database and reverse proxy health checks.
8. Run `sudo sh scripts/install-backup-cron.sh`; configure rclone and a protected `/etc/4n-dev-core/backup.env` for off-server copies.
9. Perform a database restore drill and confirm backup retention.
10. Verify all required provider environment variables, especially payment/webhook configuration, against the provider adapters before enabling live payments.
11. Review app deployment isolation, resource limits, upload handling, logs, and rollback before accepting customer workloads.
12. Migrate traffic from Render only after production checks pass; keep the current service available until the migration is verified.

## Important boundaries

- No VPS installation, DNS change, HTTPS issuance, scheduled backup, off-server backup, or Render migration is completed by this repository audit.
- The existing local backup script is not itself a scheduled or off-site backup system.
- Do not expose PostgreSQL or the Docker API to the public Internet.
- Do not put live secrets in GitHub or share them in chat.
