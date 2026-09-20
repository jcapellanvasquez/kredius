# Kredius — k3s lab deployment

## Apply order (first time)

Run from the `k8s/` directory on the server:

```bash
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-secret.yaml
kubectl apply -f 20-backend.yaml
kubectl apply -f 30-frontend.yaml
kubectl apply -f 40-ingress.yaml
```

## Build and load images

Build one at a time (memory is limited). From the repo root:

```bash
# Backend
docker build -t kredius-backend:0.1.0 ./be
docker save kredius-backend:0.1.0 | sudo k3s ctr images import -

# Frontend
docker build -t kredius-frontend:0.1.0 ./ui
docker save kredius-frontend:0.1.0 | sudo k3s ctr images import -
```

## Update to a new version

```bash
# Build with the new tag
docker build -t kredius-backend:0.2.0 ./be
docker save kredius-backend:0.2.0 | sudo k3s ctr images import -

# Edit 20-backend.yaml: change image tag to 0.2.0, then apply
kubectl apply -f 20-backend.yaml
# Recreate strategy means the old pod is stopped before the new one starts.
```

## Verify

```bash
kubectl get pods,svc,ingress -n kredius
curl -H "Host: kredius.lab" http://10.0.0.49/api/v1/health
curl -H "Host: kredius.lab" http://10.0.0.49/
```

## Delete everything

```bash
kubectl delete namespace kredius
# Images stay in k3s — remove with:
sudo k3s ctr images rm kredius-backend:0.1.0 kredius-frontend:0.1.0
```

## Switch to real Postgres (when ready)

1. Add credentials to `01-secret.yaml` (keys: `postgres-user`, `postgres-password`) and re-apply.
2. Apply `10-postgres.yaml` and wait for the pod to be Ready.
3. In `20-backend.yaml`, uncomment the `SPRING_DATASOURCE_*` env vars and re-apply.
4. The backend restarts, connects to the `postgres` Service, and DataInitializer re-seeds test data.
5. Lower the backend memory limit from 1200Mi to 768Mi (Postgres now runs in its own pod, not inside the JVM process).
