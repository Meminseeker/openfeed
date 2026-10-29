# Deploy OpenFeed on DigitalOcean

This setup runs one OpenFeed instance behind Caddy at **https://openfeed.meminseeker.com**. Caddy manages TLS certificates; the application provides individual account signup and login. The app has no published host port. SQLite and Caddy certificates live in persistent Docker volumes. No CI/CD, managed database, or Kubernetes is required.

Each account has separate creators, content, notes, read state, playlists and links. Browser drafts are account-scoped and device-local; wait for notes to save before switching devices. Public icons and the manifest are intentionally accessible without login. API and media access require a session.

## Upgrade an existing workspace

1. Back up the database volume using the procedure below before starting the new version. The schema migration is transactional but older versions cannot read the new tables; rollback requires restoring the backup.
2. In `.env`, set `OPENFEED_SETUP_TOKEN` to a long random secret (generate one with `openssl rand -hex 32`). Set `OPENFEED_RETENTION_DAYS=7` explicitly if your old `.env` still says 90.
3. Deploy **both** the app and the updated `deploy/Caddyfile`/Compose configuration. The old HTTP Basic Auth gate is replaced by application login. Do not keep a Basic Auth gate in front of the icons or manifest.
4. Open the app, choose **Create an account**, and enter the setup token. That account atomically claims all existing creators, posts, saved items and notes. Until a correct token is provided, signup is blocked and the legacy data is not pruned. After claiming, the configured retention applies to unsaved/unannotated feed items.
5. Remove `OPENFEED_SETUP_TOKEN` from `.env` and recreate the app. Friends can now sign up for their own empty workspaces. The old `OPENFEED_AUTH_USER` and `OPENFEED_AUTH_HASH` variables are no longer used.

Fresh, empty installations do not require a setup token. Login sessions last 30 days and logout revokes the current session. Password-reset email is not implemented; use a password manager. Keep the application port private behind Caddy. Production trusts exactly one proxy for the client IP used in login rate limits; never expose port 3000 directly.

## Size and cost

These are starting estimates, not measured capacity guarantees:

| Use                               | CPU    | RAM   | SSD    | Notes                                                                                |
| --------------------------------- | ------ | ----- | ------ | ------------------------------------------------------------------------------------ |
| Minimum for light personal use    | 1 vCPU | 1 GiB | 25 GiB | Add 1–2 GiB swap; image builds may run out of memory. Build elsewhere if necessary. |
| Recommended starting Droplet      | 1 vCPU | 2 GiB | 50 GiB | Better headroom for builds and a few friends with separate workspaces.                 |
| Grow when measurements justify it | 2 vCPU | 4 GiB | 80 GiB | Large feeds, heavier refreshes, or simultaneous video playback.                      |

Use a Basic Droplet with Ubuntu 24.04 LTS, in a region near you. Standard shared CPU is sufficient to start. DigitalOcean currently lists the 2 GiB / 1 vCPU / 50 GiB Basic plan at **US$12/month**; confirm at checkout. Backups, taxes, optional platform API usage, and excess transfer are additional. See [Droplet pricing](https://www.digitalocean.com/pricing/droplets) (checked October 6, 2026).

Media mostly loads from upstream CDNs. X video streams through this server, using outbound bandwidth. The app reads the whole feed from SQLite into memory; database size and peak memory increase with retained posts. Unsaved feed posts without notes expire after seven days by default. Playlist items and links are exempt. Monitor `docker stats`, `df -h`, and `docker system df`; upgrade before the disk fills. Public platform endpoints may block datacenter IPs, so cloud ingestion can behave differently from your laptop. The UI reports source failures; official APIs are optional and may cost money.

## 1. Create the server and DNS

1. Create the Droplet with your SSH public key and Ubuntu 24.04 LTS. Enable provider backups if desired, but also keep application backups off-server.
2. At the authoritative DNS provider for `meminseeker.com`, add an **A** record named `openfeed` pointing to the Droplet's IPv4 address. The root domain can stay where it is. Only add an AAAA record if IPv6 is configured and reachable; stale AAAA records can break certificate issuance.
3. Attach a DigitalOcean Cloud Firewall: inbound TCP **22** from your administrator IP(s), and TCP **80/443** from anywhere. If using IPv6, apply equivalent IPv6 rules. Allow outbound traffic for DNS, certificate issuance, image pulls, and platform requests. Do not allow inbound port 3000. Use the provider firewall because Docker-published ports can bypass host UFW rules.
4. SSH to the Droplet. Create a normal sudo-capable administrator if you started as root. Use SSH keys; verify access in a second session before disabling password/root SSH login. Keep Ubuntu security updates enabled.

```sh
ssh root@YOUR_DROPLET_IP
sudo apt update
sudo apt upgrade -y
sudo apt install -y git
```

Install Docker Engine, Buildx, and the Compose plugin using Docker's [official Ubuntu repository instructions](https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository). Check:

```sh
sudo docker version
sudo docker compose version
```

Commands below use `sudo docker` so you do not need to grant a user Docker-group privileges (which are equivalent to root access).

## 2. Copy the project and configure access

Clone your repository on the server, or copy the source using SSH. Do not copy local `node_modules`, `dist`, or secrets into the image. For example, after replacing the repository URL:

```sh
git clone --branch dev YOUR_REPOSITORY_URL openfeed
cd openfeed
cp .env.example .env
chmod 600 .env
```

Edit `.env` with:

```dotenv
OPENFEED_DOMAIN=openfeed.meminseeker.com
ACME_EMAIL=YOUR_REAL_EMAIL
OPENFEED_RETENTION_DAYS=7
# Only needed when upgrading an existing workspace:
OPENFEED_SETUP_TOKEN=YOUR_RANDOM_SECRET
```

`.env` is ignored by Git and excluded from the Docker build context. Keep it private; `docker compose config` without `--quiet` may print resolved credentials. Docker administrators can inspect container environment variables.

Optional X/Instagram variables in `.env` match the integration configuration in the [README](../README.md). They stay server-side. Leave them blank for public-page mode. Set all three Instagram variables together when using Business Discovery.

## 3. Build and start

Run from the repository root after DNS has propagated:

```sh
sudo docker compose config --quiet
sudo docker compose build --pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 app caddy
```

Open **https://openfeed.meminseeker.com** and create your account. For an upgrade, follow the workspace claim steps above. Caddy obtains and renews certificates and redirects HTTP to HTTPS. Its certificate state is persisted. See [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).

Check public installation assets and protected data separately:

```sh
curl -I https://openfeed.meminseeker.com/icons/app-192.png
curl https://openfeed.meminseeker.com/healthz
curl -i https://openfeed.meminseeker.com/api/state
```

The icon should return **200** with an image content type, health should return `{"ok":true}`, and unauthenticated state should return **401**. Add a creator, save a note, restart the app, and verify persistence. Sign up a second account and confirm it has an empty workspace. Test playback and notes from your phone. If an existing installed icon still shows “O”, remove and reinstall the home-screen app after updating.

If certificates fail, check DNS A/AAAA, firewall ports, and Caddy logs. For 403 responses, ensure `.env` contains only the hostname and you visit that exact HTTPS domain. The server validates the configured origin directly.

The app runs as the non-root `node` user with a read-only container filesystem, writes only to its data volume and temporary directory, and uses Node 24's native TypeScript support. Its production image contains no build/dev dependencies. The container health check probes the app directly; external monitoring can probe the public HTTPS health endpoint. Restart policies recover process exits and host restarts; an unhealthy running container is not automatically restarted by Compose.

## 4. Move existing local data (optional)

Stop the local OpenFeed process first and archive the **entire** local `data/` directory, including any SQLite WAL/SHM files. From the local repository:

```sh
tar -czf /tmp/openfeed-data.tar.gz -C data .
scp /tmp/openfeed-data.tar.gz YOUR_SSH_USER@YOUR_DROPLET_IP:~/openfeed-data.tar.gz
```

On the server, before the first start (or with the app stopped and an empty data volume), from the repository root:

```sh
sudo docker compose build
sudo docker compose stop app
sudo docker compose run --rm --no-deps --user root \
  -v "$HOME/openfeed-data.tar.gz:/restore/data.tar.gz:ro" \
  --entrypoint sh app -c 'tar -xzf /restore/data.tar.gz -C /app/data && chown -R node:node /app/data'
sudo docker compose up -d
```

The original local data is not uploaded automatically and never becomes part of the image. Browser drafts are not included in the database archive.

## 5. Back up and restore

Back up before each update and at least daily when actively using the app. Keep dated copies off the Droplet, encrypted when they contain private notes. A same-server archive does not protect against server loss. This simple procedure briefly stops the app so the database and any WAL files are consistent. Caddy may return 502 during the pause.

From the repository root:

```sh
mkdir -p backups
chmod 700 backups
sudo docker compose stop app
sudo docker compose run --rm --no-deps --user root \
  -v "$PWD/backups:/backup" --entrypoint sh app \
  -c 'umask 077; tar -czf /backup/openfeed-$(date -u +%Y%m%dT%H%M%SZ).tar.gz -C /app/data .'
sudo docker compose start app
```

Restart the app even if the archive command fails, then investigate the failure. Because these archives are created by root with restrictive permissions, use `sudo` to inspect/copy them, or change ownership to your administrator before transferring them over SSH. Keep a separate secure copy of `.env` and the deployed Git commit (`git rev-parse HEAD`). Caddy certificates can be reissued; keeping its volume avoids unnecessary reissuance. Do not use `docker compose down -v`: it deletes the persistent volumes.

For a restore, first back up the current database, then stop the app. Replace `BACKUP_FILENAME` below with the selected dated archive. **This replaces all current workspace data**:

```sh
sudo docker compose stop app
sudo docker compose run --rm --no-deps --user root \
  -v "$PWD/backups:/backup:ro" --entrypoint sh app \
  -c 'rm -f /app/data/openfeed.db /app/data/openfeed.db-wal /app/data/openfeed.db-shm; tar -xzf /backup/BACKUP_FILENAME -C /app/data && chown -R node:node /app/data'
sudo docker compose start app
```

Only restore trusted archives. Verify creators and a known note after restoring. Practice a restore on a separate instance before relying on backups.

## 6. Manual updates and rollback

Before updating, record the current commit and back up data. Keep the working tree clean; `.env` remains untracked. Review release notes for schema changes.

```sh
git rev-parse HEAD
git switch dev
git pull --ff-only origin dev
sudo docker compose build --pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 app
```

A build failure leaves the running containers unchanged. Successful replacement causes a short interruption. To update Caddy too, run `sudo docker compose pull caddy` before `up -d`. Images track Node 24 and Caddy 2; for repeatable product releases, pin tested image digests and record release tags rather than relying on moving tags.

To roll back, check out the previously recorded commit, build it, and run `up -d` again. Restore the corresponding database backup if a newer release made an incompatible schema change. Recheck HTTPS, note saves, and refreshes after every update. Prune old unused images selectively when disk space is low; preserve volumes and backups.

## Path to a product

This deployment is a useful starting point for a private service. Before selling access, add password reset or managed identity, further abuse controls, observable background refresh jobs, export/account deletion, and automated backup restore checks. Individual accounts, secure sessions, API ownership checks and basic authentication rate limiting are already provided. Review platform API terms and usage costs. SQLite is suitable for this single instance; decide whether to move to PostgreSQL based on actual multi-user/concurrency needs. Never scale replicas against this local SQLite volume. Start release versioning and database migration discipline before schema changes; CI/CD can wait until it provides value.
