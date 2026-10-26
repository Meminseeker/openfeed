# Deploy OpenFeed on DigitalOcean

This setup runs one OpenFeed instance behind Caddy at **https://openfeed.meminseeker.com**. Caddy requires a password for every application request and manages TLS certificates. The app has no published host port. SQLite and Caddy certificates live in persistent Docker volumes. No CI/CD, managed database, or Kubernetes is required.

This is a **shared personal workspace**. Everyone with access can see and edit the same creators, notes, saved posts, and read state. Browser drafts remain device-local; wait for notes to save before switching devices. Password protection does not add separate user accounts. Only invite friends if this sharing is acceptable.

## Size and cost

These are starting estimates, not measured capacity guarantees:

| Use                               | CPU    | RAM   | SSD    | Notes                                                                                |
| --------------------------------- | ------ | ----- | ------ | ------------------------------------------------------------------------------------ |
| Minimum for light personal use    | 1 vCPU | 1 GiB | 25 GiB | Add 1–2 GiB swap; image builds may run out of memory. Build elsewhere if necessary. |
| Recommended starting Droplet      | 1 vCPU | 2 GiB | 50 GiB | Better headroom for builds and a few friends sharing this workspace.                 |
| Grow when measurements justify it | 2 vCPU | 4 GiB | 80 GiB | Large feeds, heavier refreshes, or simultaneous video playback.                      |

Use a Basic Droplet with Ubuntu 24.04 LTS, in a region near you. Standard shared CPU is sufficient to start. DigitalOcean currently lists the 2 GiB / 1 vCPU / 50 GiB Basic plan at **US$12/month**; confirm at checkout. Backups, taxes, optional platform API usage, and excess transfer are additional. See [Droplet pricing](https://www.digitalocean.com/pricing/droplets) (checked October 6, 2026).

Media mostly loads from upstream CDNs. X video streams through this server, using outbound bandwidth. The app reads the whole feed from SQLite into memory; database size and peak memory increase with retained posts. There is no automatic retention policy. Monitor `docker stats`, `df -h`, and `docker system df`; upgrade before the disk fills. Public platform endpoints may block datacenter IPs, so cloud ingestion can behave differently from your laptop. The UI reports source failures; official APIs are optional and may cost money.

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
git clone YOUR_REPOSITORY_URL openfeed
cd openfeed
cp .env.example .env
chmod 600 .env
sudo docker run --rm -it caddy:2-alpine caddy hash-password
```

The last command prompts for a strong password and prints a bcrypt hash. Edit `.env` with:

```dotenv
OPENFEED_DOMAIN=openfeed.meminseeker.com
ACME_EMAIL=YOUR_REAL_EMAIL
OPENFEED_AUTH_USER=alvin
OPENFEED_AUTH_HASH='$2a$YOUR_COMPLETE_GENERATED_HASH'
```

Use the complete generated hash, **inside single quotes**. Compose otherwise interprets the dollar signs. Do not use the example placeholder. Save the password in your password manager. `.env` is ignored by Git and excluded from the Docker build context. Keep it private; `docker compose config` without `--quiet` may print resolved credentials. Docker administrators can inspect container environment variables.

Optional X/Instagram variables in `.env` match the integration configuration in the [README](../README.md). They stay server-side. Leave them blank for public-page mode. Set all three Instagram variables together when using Business Discovery.

The password prompt works in desktop and mobile browsers. For friends, you can add a separate `username bcrypt_hash` line inside `basic_auth` in `deploy/Caddyfile`, then recreate Caddy. These still grant access to the same workspace. Basic authentication has no application logout or built-in rate limiting; browsers can remember credentials until closed. For stronger personal access control, place an identity-aware gateway or private VPN in front later.

## 3. Build and start

Run from the repository root after DNS has propagated:

```sh
sudo docker compose config --quiet
sudo docker compose build --pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 app caddy
```

Open **https://openfeed.meminseeker.com** on your laptop or phone and enter your credentials. Caddy obtains and renews certificates, redirects HTTP to HTTPS, and protects the UI, API, and video proxy. Its certificate state is persisted. See [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https) and [password authentication](https://caddyserver.com/docs/caddyfile/directives/basic_auth).

Check that an unauthenticated HTTPS request returns **401**, then check authenticated access (curl prompts for the password):

```sh
curl -I https://openfeed.meminseeker.com
curl --user alvin https://openfeed.meminseeker.com/healthz
```

The authenticated health response should be `{"ok":true}`. Add a creator, refresh, save a note, restart the app with `sudo docker compose restart app`, and verify persistence. Test video playback and note saving from your phone. If certificates fail, check DNS A/AAAA, firewall ports, and Caddy logs. If requests return 403, ensure `.env` uses only the hostname and you are visiting that exact domain. The server validates the configured HTTPS origin directly; it does not trust arbitrary forwarded headers.

The app runs as the non-root `node` user with a read-only container filesystem, writes only to its data volume and temporary directory, and uses Node 24's native TypeScript support. Its production image contains no build/dev dependencies. The container health check probes the app directly; external monitoring should probe through authenticated HTTPS too. Restart policies recover process exits and host restarts; an unhealthy running container is not automatically restarted by Compose.

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
git pull --ff-only
sudo docker compose build --pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 app
```

A build failure leaves the running containers unchanged. Successful replacement causes a short interruption. To update Caddy too, run `sudo docker compose pull caddy` before `up -d`. Images track Node 24 and Caddy 2; for repeatable product releases, pin tested image digests and record release tags rather than relying on moving tags.

To roll back, check out the previously recorded commit, build it, and run `up -d` again. Restore the corresponding database backup if a newer release made an incompatible schema change. Recheck HTTPS, note saves, and refreshes after every update. Prune old unused images selectively when disk space is low; preserve volumes and backups.

## Path to a product

This deployment is a useful starting point for a private service. Before selling access, add application accounts, secure sessions, password reset or managed identity, authorization and per-user data ownership; sharing proxy passwords is insufficient for customer isolation. Add rate limits, abuse controls, observable background refresh jobs, retention/export/delete policies, and automated backup restore checks. Review platform API terms and usage costs. SQLite is suitable for this single instance; decide whether to move to PostgreSQL based on actual multi-user/concurrency needs. Never scale replicas against this local SQLite volume. Start release versioning and database migration discipline before schema changes; CI/CD can wait until it provides value.
