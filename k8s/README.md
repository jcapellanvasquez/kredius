# Kredius: k3s lab deployment

Kredius runs on the lab server (`coolestserver`, 10.0.0.49) in the `kredius` namespace (server setup, sudo rules, backups and restore: [`SERVER.md`](SERVER.md)):

| File | What |
|---|---|
| `00-namespace.yaml` | the `kredius` namespace |
| `01-secret.yaml` | `kredius-secret`: DB user and password, default session user id |
| `10-postgres.yaml` | Postgres StatefulSet `postgres-0` with its PVC, Service `postgres` |
| `20-backend.yaml` | Spring Boot backend (`kredius-backend:<tag>`), Recreate strategy |
| `30-frontend.yaml` | Angular frontend on nginx (`kredius-frontend:<tag>`) |
| `40-ingress.yaml` | Traefik ingress: `kredius.lab` and `kredius.10.0.0.49.nip.io`; `/api` → backend, `/` → frontend |

All of it is already applied. Images are built on the server and imported into k3s; there is no registry (`imagePullPolicy: IfNotPresent`).

## Deploying a new version

The full procedure (backup, build, import, apply, verify, rollback, cleanup) lives in the `/lab` Claude skill and in `be/external-files/lab-deploy-plan.md`. In short, from `~/kredius` on the server, with `main` pulled and the new tag already committed in `20-backend.yaml` and `30-frontend.yaml`:

```bash
# 1. Back up the DB first
~/bin/kredius-backup deploy <tag>
# 2. Build and import, one image at a time (memory is limited)
docker build -t kredius-backend:<tag> ./be
docker save kredius-backend:<tag> | sudo -n k3s ctr images import -
docker build -t kredius-frontend:<tag> ./ui
docker save kredius-frontend:<tag> | sudo -n k3s ctr images import -
# 3. Apply and wait
kubectl apply -f k8s/20-backend.yaml -f k8s/30-frontend.yaml
kubectl rollout status deployment/kredius-backend -n kredius
kubectl rollout status deployment/kredius-frontend -n kredius
```

Recreate strategy: the old backend pod stops before the new one starts. On startup Flyway applies any new migration and Hibernate validates the schema; either failing keeps the pod from becoming Ready.

**Rollback:** `kubectl rollout undo deployment/kredius-backend -n kredius` (2 old ReplicaSets are kept), then revert the tag commit so git matches what runs. Restore the backup only if a migration broke the schema.

## Disk cleanup

Every deploy leaves old images in k3s. `scripts/kredius-prune-images` deletes all but the 2 newest tags of each image, and never a tag a ReplicaSet still references. It needs root, so it is installed once:

```bash
sudo install -o root -g root -m 755 k8s/scripts/kredius-prune-images /usr/local/sbin/
echo 'jcapellan ALL=(root) NOPASSWD: /usr/local/sbin/kredius-prune-images' | sudo tee /etc/sudoers.d/kredius-prune
sudo chmod 440 /etc/sudoers.d/kredius-prune && sudo visudo -cf /etc/sudoers.d/kredius-prune
```

Then, after a verified deploy: `sudo -n /usr/local/sbin/kredius-prune-images --dry-run`, and without `--dry-run` to delete. Re-run the `install` line when the script changes.

## Verify

```bash
kubectl get pods,svc,ingress -n kredius
kubectl exec deploy/kredius-backend -n kredius -- wget -qO- localhost:8080/health   # health is not under /api, so not on the ingress
curl -H "Host: kredius.lab" http://10.0.0.49/api/v1/accounts
curl -H "Host: kredius.lab" http://10.0.0.49/
kubectl exec postgres-0 -n kredius -- psql -U kredius -d kredius -c "select version, description, success from flyway_schema_history"
```
