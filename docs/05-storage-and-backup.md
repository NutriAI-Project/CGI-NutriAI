# Dynamic Storage & Backup

## StorageClasses

| Name | Provisioner | Use | Access mode |
|---|---|---|---|
| `nutriai-gp3` | `ebs.csi.aws.com` | Postgres data, Postgres backups | ReadWriteOnce |
| `nutriai-efs` | `efs.csi.aws.com` | `document-service` uploads (shared across replicas) | ReadWriteMany |

Both are `WaitForFirstConsumer`/dynamic (`allowVolumeExpansion: true`,
`reclaimPolicy: Retain` — a deleted PVC does **not** delete the underlying
EBS volume/EFS access point, by design, so a bad `helm uninstall` can't
destroy your data). Requires the EBS and EFS CSI drivers installed
([03-aws-bootstrap.md](03-aws-bootstrap.md) §5–6).

## PostgreSQL

Single-instance `StatefulSet` (`helm/nutriai/templates/postgres.yaml`) with
a `volumeClaimTemplate` on `nutriai-gp3`, default 5Gi. This is a lab-scope
choice — for a real production environment, migrate to Amazon RDS
(Multi-AZ) and point `DATABASE_URL` at it instead; the Helm chart's
`postgres.enabled: false` switch turns off the in-cluster instance so you
only need to update each service's connection string.

## Backup

`templates/backup-cronjob.yaml` runs a `pg_dump` `CronJob` (default
`0 2 * * *`, 7-day retention) to a **separate** PVC
(`postgres-backup-data`, also dynamically provisioned on `nutriai-gp3`) —
kept apart from the live data volume so a corrupted live disk can't take
the backups down with it.

```bash
# List backups
kubectl -n nutriai-prod run -it --rm backup-shell --image=busybox --restart=Never \
  --overrides='{"spec":{"containers":[{"name":"backup-shell","image":"busybox","command":["sh"],"stdin":true,"tty":true,"volumeMounts":[{"name":"b","mountPath":"/backup"}]}],"volumes":[{"name":"b","persistentVolumeClaim":{"claimName":"postgres-backup-data"}}]}}' \
  -- ls -la /backup

# Trigger an ad-hoc backup outside the schedule
kubectl -n nutriai-prod create job --from=cronjob/postgres-backup postgres-backup-manual-$(date +%s)
```

### Restore

```bash
# Copy a dump out of the backup PVC and pipe it into psql against the live DB
kubectl -n nutriai-prod exec -it postgres-0 -- \
  psql -U nutriai_user -d nutriai -c "SELECT 1;"   # sanity check first

# From a pod that has both volumes mounted (or scp the file out via the bastion),
# then restore with:
gunzip -c nutriai-<timestamp>.sql.gz | kubectl -n nutriai-prod exec -i postgres-0 -- \
  psql -U nutriai_user -d nutriai
```

### Volume snapshots (point-in-time, whole-disk) — optional, off by default

`storage.volumeSnapshots.enabled` (default `false`) gates the
`VolumeSnapshotClass`. It needs the external-snapshotter CRDs + controller,
a separate component from the EBS CSI driver — not installed by
`scripts/03-install-cluster-addons.sh`, and skipped by default so a fresh
cluster syncs cleanly without it (ArgoCD syncs atomically — one missing CRD
fails the whole Application). The `pg_dump` CronJob backup above works
independently of this and needs none of it. Install the CRDs/controller
(commands in `templates/storageclass.yaml`) and flip the flag on to get
crash-consistent EBS snapshots as a second backup layer alongside logical
`pg_dump`s:

```bash
cat <<EOF | kubectl apply -f -
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: postgres-data-snap-$(date +%Y%m%d)
  namespace: nutriai-prod
spec:
  volumeSnapshotClassName: nutriai-ebs-snapshot
  source:
    persistentVolumeClaimName: postgres-data-postgres-0
EOF
```

For a fully managed/automated schedule of these, consider adding
[Velero](https://velero.io/) once you're past the lab stage — noted here as
the natural next step, not implemented in this repo to keep the add-on
footprint inside the 2-node budget.

## document-service uploads (RWX)

Mounted at `/app/uploads` from the `nutriai-efs` PVC
(`document-uploads`, 10Gi, `ReadWriteMany`) so any replica can serve any
previously-uploaded file. The service currently defaults to Azure Blob
Storage via `AZURE_STORAGE_CONNECTION_STRING` (see
[07-helm-charts.md](07-helm-charts.md) for secret wiring) — the PVC is
mounted and ready, but pointing the app at local disk instead of Blob
Storage needs a small code change in `services/document-service` to honor
a local-path setting. Flagging this explicitly rather than pretending it's
already wired end-to-end.
