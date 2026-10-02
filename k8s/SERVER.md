# Lab server: how Kredius is set up

Everything on `coolestserver` that Kredius relies on and that isn't in a manifest. Deploy steps are in [`README.md`](README.md); the full procedure Claude follows is the `/lab` skill (`~/.claude/skills/lab/SKILL.md` on the dev PC).

## Machine and access

| | |
|---|---|
| Host | `coolestserver`, 10.0.0.49, Ubuntu, k3s single node, time zone **UTC** |
| User | `jcapellan`, in the `docker` group; `kubectl` config in `~/.kube/config` |
| SSH from WSL | `ssh lab` (alias in `~/.ssh/config`, ed25519 key, no passphrase) |
| URLs | `http://kredius.lab` and `http://kredius.10.0.0.49.nip.io` (needs no DNS) |
| Versions (2026-10-02) | Ubuntu 24.04.3, kernel 6.8, k3s v1.36.4+k3s1 (bundled Traefik, local-path storage), Docker 28.5.1 + Compose v2.40.2, git 2.43; 8 CPU, 15 GB RAM, 98 GB disk |

Other projects run on the same machine (pi-hole, jellyfin, odoo, …). Pi-hole is the LAN DNS: don't touch it.

**DNS:** pi-hole (container `pihole`) answers every `*.lab` name with the server's IP, through one line in `/etc/pihole/pihole.toml`, under `misc`: `dnsmasq_lines = [ "address=/lab/10.0.0.49" ]`. Set it in the pi-hole web UI under Settings → All settings → Miscellaneous → `misc.dnsmasq_lines`.

**k3s config:** `/etc/rancher/k3s/config.yaml` has `write-kubeconfig-mode: '0644'`; `~/.kube/config` is a copy of `/etc/rancher/k3s/k3s.yaml` (server `https://127.0.0.1:6443`).

## Two Postgres instances

| | k3s `postgres-0` | Docker `kredius-postgres-1` |
|---|---|---|
| Used by | the deployed app (`kredius.lab`) | local development (`jdbc:postgresql://10.0.0.49:5432/kredius`) |
| Image | `kredius-db:0.1.0` (in k3s) | `kredius-db:local` (in Docker, `docker compose` in `~/kredius`) |
| Data | PVC `postgres-pvc` (2Gi, local-path) | Docker volume |
| Backed up | yes, daily and before every deploy | no: dev data |

Both are schema-managed by Flyway (`be/src/main/resources/db/migration`). Both images are built from [`../db`](../db): `postgres:16-alpine` plus `init/01-init.sql`, which only makes sure the `kredius` role exists.

**Careful:** the k3s volume is `local-path` with reclaim policy **Delete**. Deleting the PVC (or the `kredius` namespace, or running `kubectl delete -f 10-postgres.yaml`) deletes the database files at `/var/lib/rancher/k3s/storage/pvc-…_kredius_postgres-pvc`. Take a backup first.

## Root-level setup (needs sudo, done once by hand)

| File | Allows `jcapellan` to run, without a password | Why |
|---|---|---|
| `/etc/sudoers.d/k3s-import` | `/usr/local/bin/k3s ctr images import -` (exactly, stdin only) | load built images into k3s |
| `/etc/sudoers.d/kredius-prune` | `/usr/local/sbin/kredius-prune-images` (any args) | delete old images from k3s |
| `/usr/local/sbin/kredius-prune-images` | root-owned copy of [`scripts/kredius-prune-images`](scripts/kredius-prune-images) | |

To update the prune script after it changes in the repo, from `~/kredius` after `git pull`:

```bash
sudo install -o root -g root -m 755 k8s/scripts/kredius-prune-images /usr/local/sbin/
```

To recreate the sudo rules on a new machine:

```bash
echo 'jcapellan ALL=(root) NOPASSWD: /usr/local/bin/k3s ctr images import -' | sudo tee /etc/sudoers.d/k3s-import
echo 'jcapellan ALL=(root) NOPASSWD: /usr/local/sbin/kredius-prune-images' | sudo tee /etc/sudoers.d/kredius-prune
sudo chmod 440 /etc/sudoers.d/k3s-import /etc/sudoers.d/kredius-prune
sudo visudo -c
```

## Folders in `~` (all `chmod 700`)

| Folder | What |
|---|---|
| `~/kredius` | git checkout of `main`, pulled on each deploy; must stay clean |
| `~/kredius-backups` | deploy backups `kredius-<UTC date>-before-<version>.dump`, newest 3 kept |
| `~/kredius-backups/daily` | daily backups `kredius-<UTC date>.dump`, newest 14 kept, plus `backup.log` |
| `~/kredius-deploys` | backend startup log of each deploy, `<version>-backend.log`, newest 5 kept |
| `~/bin` | `kredius-backup` (copy of [`scripts/kredius-backup`](scripts/kredius-backup)) |

Dumps hold personal financial data: they are `600`, inside `700` folders.

## Backups

[`scripts/kredius-backup`](scripts/kredius-backup) dumps `postgres-0` in custom format and keeps the file only if it passes 3 checks: not empty, `PGDMP` header, and its table of contents lists `accounts`, `journal_entries` and `statement_lines`. Old dumps are deleted only after a valid new one.

| When | Command | Kept |
|---|---|---|
| Daily, 07:00 UTC (03:00 DR) | cron: `~/bin/kredius-backup daily >> ~/kredius-backups/daily/backup.log 2>&1` | 14 |
| Before each deploy | `~/bin/kredius-backup deploy <version>` | 3 |

- Check it ran: `tail ~/kredius-backups/daily/backup.log`. Each run writes one `OK` or `FAILED` line.
- See the schedule: `crontab -l`.
- Update the script after it changes in the repo: `install -m 755 ~/kredius/k8s/scripts/kredius-backup ~/bin/`.
- **Limit:** the backups are on the same disk as the database. They protect against a bad deploy or a bad migration, not a disk failure. Copying them off the server is still to do.

### Restore

Test a dump without touching the live database (done 2026-10-02: restored with the expected row counts):

```bash
F=~/kredius-backups/daily/kredius-<date>.dump
kubectl exec postgres-0 -n kredius -- createdb -U kredius kredius_restore_test
kubectl exec -i postgres-0 -n kredius -- pg_restore -U kredius -d kredius_restore_test --no-owner < "$F"
kubectl exec postgres-0 -n kredius -- psql -U kredius -d kredius_restore_test -c "select count(*) from statement_lines"
kubectl exec postgres-0 -n kredius -- dropdb -U kredius kredius_restore_test
```

Restore over the live database (stops the app first; replaces all its data with the dump's):

```bash
kubectl scale deployment/kredius-backend -n kredius --replicas=0
kubectl exec postgres-0 -n kredius -- psql -U kredius -d kredius -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
kubectl exec -i postgres-0 -n kredius -- pg_restore -U kredius -d kredius --no-owner < "$F"
kubectl scale deployment/kredius-backend -n kredius --replicas=1
```

The image you bring back must match the dump's Flyway version (`select max(version) from flyway_schema_history`); roll the backend back first if the dump is older than the running schema.

## Images and disk

- `kredius-backend` / `kredius-frontend`: kept in Docker and in k3s for the current and previous tag; deploys clean up the rest (`docker rmi`, `kredius-prune-images`, `docker builder prune -f --max-used-space 2GB`).
- **Never remove** `kredius-db:local` (the dev Postgres container's image) or `kredius-db:0.1.0` (what `postgres-0` runs).
- Disk on 2026-10-02 after the first cleanup: 98 GB, 28 GB used.

## Credentials

The DB user and password are in the k8s Secret `kredius-secret`, applied from `01-secret.yaml`, which is committed in this public repo. Moving them into an env file outside the repo, and changing the password, is planned: `be/external-files/secrets-proposal.md` on the dev PC.

## Move to a new server

What has to move: the **database** (a dump) and the **setup** in this file. Everything else is rebuilt from git. Plan about an hour. Replace `NEW_IP` below with the new server's address.

### 1. On the old server, take a final backup

```bash
~/bin/kredius-backup deploy move           # stops nothing, just dumps and checks
ls -l ~/kredius-backups/*-before-move.dump
```

Copy it to the dev PC (WSL): `scp lab:kredius-backups/kredius-*-before-move.dump ~/`. From here on, don't use the old app, or the dump goes stale.

### 2. Base system (new server, Ubuntu 24.04, as a sudo user)

```bash
sudo adduser jcapellan && sudo usermod -aG sudo jcapellan     # if the user doesn't exist
# Docker Engine + Compose plugin: follow docs.docker.com/engine/install/ubuntu, then:
sudo usermod -aG docker jcapellan                              # log out and back in
sudo apt install -y git
sudo timedatectl set-timezone Etc/UTC                          # the backup schedule assumes UTC
```

### 3. SSH from the dev PC

On the new server, add the dev PC's public key (`~/.ssh/id_ed25519.pub` in WSL) to `/home/jcapellan/.ssh/authorized_keys` (`chmod 700 ~/.ssh`, `chmod 600 ~/.ssh/authorized_keys`). In WSL, change `HostName` under `Host lab` in `~/.ssh/config` to `NEW_IP`, then check `ssh -o BatchMode=yes lab true`.

### 4. k3s

```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.36.4+k3s1 sh -s - --write-kubeconfig-mode 0644
mkdir -p ~/.kube && cp /etc/rancher/k3s/k3s.yaml ~/.kube/config && chmod 600 ~/.kube/config
kubectl get nodes                                              # Ready
kubectl get pods -n kube-system                                # traefik, coredns, local-path-provisioner Running
```

A newer k3s is fine; pin the version above only if something breaks.

### 5. Code, folders, scripts, sudo rules

```bash
git clone https://github.com/jcapellanvasquez/kredius.git ~/kredius
mkdir -p ~/kredius-backups/daily ~/kredius-deploys ~/bin
chmod 700 ~/kredius-backups ~/kredius-backups/daily ~/kredius-deploys
install -m 755 ~/kredius/k8s/scripts/kredius-backup ~/bin/
sudo install -o root -g root -m 755 ~/kredius/k8s/scripts/kredius-prune-images /usr/local/sbin/
```

Then the two sudo rules, exactly as in "Root-level setup" above.

### 6. Point the repo at the new IP

The IP is hardcoded in two places. Change them in a commit on `main` (from the dev PC), push, and `git pull` on the server:

- `k8s/40-ingress.yaml`: host `kredius.10.0.0.49.nip.io` → `kredius.NEW_IP.nip.io`
- `be/src/main/resources/application.yml`: default `jdbc:postgresql://10.0.0.49:5432/kredius` → `NEW_IP` (dev only; the k8s backend sets its own URL)

Also update the IP in this file, in the `/lab` skill (`~/.claude/skills/lab/SKILL.md` on the dev PC) and in `~/.claude/settings.json` (`autoMode.environment`, "Home lab server").

### 7. Images

The manifests name the tags to build (`grep image: k8s/*.yaml`). From `~/kredius`, one at a time:

```bash
docker build -t kredius-db:0.1.0 ./db
docker save kredius-db:0.1.0 | sudo -n k3s ctr images import -
docker build -t kredius-backend:<tag> ./be
docker save kredius-backend:<tag> | sudo -n k3s ctr images import -
docker build -t kredius-frontend:<tag> ./ui
docker save kredius-frontend:<tag> | sudo -n k3s ctr images import -
```

### 8. Database first, then restore, then the app

The backend must not start before the restore: on an empty database Flyway would create the schema and `DataInitializer` would seed it, and the restore would then collide with those rows.

```bash
cd ~/kredius
kubectl apply -f k8s/00-namespace.yaml -f k8s/01-secret.yaml -f k8s/10-postgres.yaml
kubectl wait --for=condition=Ready pod/postgres-0 -n kredius --timeout=180s
# from WSL first: scp ~/kredius-*-before-move.dump lab:kredius-backups/
kubectl exec -i postgres-0 -n kredius -- pg_restore -U kredius -d kredius --no-owner < ~/kredius-backups/kredius-*-before-move.dump
kubectl exec postgres-0 -n kredius -- psql -U kredius -d kredius -c "select max(version) from flyway_schema_history; select count(*) from statement_lines;"
kubectl apply -f k8s/20-backend.yaml -f k8s/30-frontend.yaml -f k8s/40-ingress.yaml
kubectl rollout status deployment/kredius-backend -n kredius --timeout=300s
```

Flyway finds its history table at the dump's version and applies only newer migrations, if any.

### 9. DNS

In pi-hole, change `misc.dnsmasq_lines` to `address=/lab/NEW_IP` (or add it on the new pi-hole if it moves too). Until then, `http://kredius.NEW_IP.nip.io` works.

### 10. Daily backup and the dev database

```bash
(crontab -l 2>/dev/null; echo "0 7 * * * /home/jcapellan/bin/kredius-backup daily >> /home/jcapellan/kredius-backups/daily/backup.log 2>&1") | crontab -
~/bin/kredius-backup daily && tail -1 ~/kredius-backups/daily/backup.log
cd ~/kredius && docker compose up -d postgres                  # dev DB on NEW_IP:5432, starts empty
```

### 11. Verify, then retire the old server

Run the checks under "Verify" in [`README.md`](README.md), open `http://kredius.lab`, and compare a month on the budget screen with the old server. Only then stop the old app (`kubectl scale deployment/kredius-backend -n kredius --replicas=0` on the old server) and keep its last dump until you're sure.
