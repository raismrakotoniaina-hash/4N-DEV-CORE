# 4N DEV Core — custom domains and customer hosting

## What is implemented in the repository

- Deployments are stored in PostgreSQL (or the local development store) and served at /sites/<slug>.
- Authenticated API endpoints manage a customer's domain mapping:
  - POST /v1/hosting/domains — attach a hostname to one of the caller's active deployments.
  - GET /v1/hosting/domains — list the caller's domain mappings.
  - POST /v1/hosting/domains/<domainId>/verify — verify ownership by DNS TXT.
  - DELETE /v1/hosting/domains/<domainId> — remove the mapping.
- Domain ownership is checked using a TXT record named _4ndev-verify.<hostname>.
- A domain is only routed to a deployment after the TXT value matches.
- Custom-domain traffic is deliberately disabled by default with ENABLE_CUSTOM_DOMAINS=false.

## DNS and HTTPS sequence after the VPS exists

1. Set PUBLIC_HOSTING_IP in the server-side .env to the VPS public IPv4.
2. Add an A record for the exact hostname being attached, pointing to that IP.
3. Add the TXT verification record returned by the API.
4. Verify the TXT record using the API.
5. Configure Nginx and issue a Let's Encrypt certificate for that hostname.
6. Confirm HTTP redirects to HTTPS, renewal works, and the site loads before setting ENABLE_CUSTOM_DOMAINS=true.

The current Nginx configuration is an HTTP bootstrap configuration for ACME validation. It is not yet a complete HTTPS/custom-domain automation system. Do not enable custom-domain routing on a public production server before HTTPS and hostname routing have been configured.

## Not implemented / requires an external provider decision

- Automatic purchase and renewal of domains on behalf of customers. This requires choosing a registrar/reseller that exposes an API, then validating its API, pricing, renewal rules, and credentials. The domain-attachment API above does not buy a domain.
- Automatic DNS edits at customer registrars. Customer DNS must currently be configured at their DNS provider.
- Automatic Nginx virtual-host generation and certificate issuance/renewal per customer domain.
- Off-site backup provider configuration. The backup script supports an optional RCLONE_REMOTE, but the server still needs rclone and a protected /etc/4n-dev-core/backup.env.
- Production validation, restore drill, and VPS deployment. None is claimed complete by this repository change.

## Backup scheduling

After Docker Compose is deployed on the VPS, run:

sudo sh scripts/install-backup-cron.sh

This schedules a local PostgreSQL dump at 02:30 server time. To enable an off-site copy, install/configure rclone and create /etc/4n-dev-core/backup.env with a line such as RCLONE_REMOTE=remote-name:4n-dev-core-backups. Keep that file root-owned and readable only by root. Confirm a successful remote copy and perform a restore drill before relying on it.
