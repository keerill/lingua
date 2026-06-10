# Lingua — managed demo infrastructure (Terraform, DigitalOcean)

Provisions the live-demo stack:

- **DOKS** — managed Kubernetes 1.36 (Helm deploys the apps here via CI).
- **Managed PostgreSQL** — 7 application databases + `keycloak`.
- **Managed Kafka** — event bus + built-in **Karapace Schema Registry** (Confluent-API compatible).
- A DO **project** + **VPC** so the apps reach PG/Kafka over the private network, locked down by a DB firewall to the cluster.

The k3d local stack (`scripts/k8s/up.sh`) is unaffected — this is the cloud path only.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform) ≥ 1.6 (or OpenTofu).
- A DigitalOcean API token: `export DIGITALOCEAN_TOKEN=dop_v1_...`
- `doctl`/`gh` optional but handy for pushing outputs into GitHub Secrets.

## Apply

```bash
cd infra/terraform
cp staging.tfvars.example staging.tfvars      # edit region/sizes if needed
terraform init
terraform apply -var-file=staging.tfvars
```

> Cost note: DOKS (3×s-2vcpu-4gb) + managed PG + managed Kafka (3 nodes) is a
> few hundred USD/month. Run `terraform destroy -var-file=staging.tfvars` when
> the demo is done.

## Wire the outputs into GitHub Secrets

The CI `deploy` job (`.github/workflows/ci.yml`) reads these. Map each Terraform
output to a secret/variable (the descriptions in `outputs.tf` restate this):

```bash
# kubeconfig (base64) + GHCR pull token
terraform output -raw kubeconfig | base64 | gh secret set STAGING_KUBECONFIG
gh secret set GHCR_PULL_TOKEN        # a PAT with read:packages (cluster pulls private images)

# PostgreSQL — one DATABASE_URL_<DB> per app database
for db in IDENTITY VOCABULARY LEARNING DIALOG CONTENT PROGRESS NOTIFICATIONS; do
  terraform output -json database_uris | jq -r ".$(echo $db | tr A-Z a-z)" \
    | gh secret set "DATABASE_URL_$db"
done
terraform output -raw managed_pg_user     | gh secret set MANAGED_PG_USER
terraform output -raw managed_pg_password | gh secret set MANAGED_PG_PASSWORD
terraform output -raw keycloak_database_url | gh secret set KEYCLOAK_DATABASE_URL

# Kafka + Karapace
terraform output -raw kafka_brokers        | gh secret set STAGING_KAFKA_BROKERS
terraform output -raw kafka_sasl_username   | gh secret set KAFKA_SASL_USERNAME
terraform output -raw kafka_sasl_password   | gh secret set KAFKA_SASL_PASSWORD
terraform output -raw kafka_ca_cert | base64 -d | gh secret set KAFKA_SSL_CA   # output is base64
terraform output -raw schema_registry_uri  | gh secret set SCHEMA_REGISTRY_URL
# Karapace basic auth = the Kafka SASL creds:
terraform output -raw kafka_sasl_username   | gh secret set SCHEMA_REGISTRY_USER
terraform output -raw kafka_sasl_password   | gh secret set SCHEMA_REGISTRY_PASSWORD
```

Plus the app-level secrets/variables the deploy job needs (not from Terraform):

```bash
gh secret set BFF_COOKIE_SECRET
gh secret set KEYCLOAK_BFF_CLIENT_SECRET     # must equal global.keycloakBffClientSecret in the realm
gh secret set KEYCLOAK_ADMIN_PASSWORD
gh secret set MINIO_ACCESS_KEY
gh secret set MINIO_SECRET_KEY
gh secret set ANTHROPIC_API_KEY              # only if svc-ai-dialog uses anthropic

gh variable set STAGING_ENABLED --body true  # gates + enables the deploy job
gh variable set STAGING_DOMAIN  --body staging.lingua.example.com
```

## DNS

After the first deploy, DOKS provisions a LoadBalancer for the Traefik ingress:

```bash
kubectl -n lingua get svc -l app.kubernetes.io/name=traefik -o wide   # external IP
```

Point `*.<STAGING_DOMAIN>` (at least `api`, `app`, `www`, `id`, `mfe-*`) at that
IP. Frontends bake the domain at build time, so `STAGING_DOMAIN` must match what
the CI docker matrix used.

## Caveats / things to confirm in the DO console

- **Schema Registry endpoint** — Karapace runs on the Kafka host; the port is a
  best-effort default (`schema_registry_port`, 25073). Confirm the exact
  endpoint in the DO control panel and adjust if needed.
- **Kafka auth** — DO Managed Kafka offers SASL_SSL *and* mTLS; `libs/kafka`
  uses SASL (`KAFKA_SASL_*` + `KAFKA_SSL_CA`).
- **Remote state** — `versions.tf` ships a commented DO Spaces (S3) backend.
  Local state is the default for a one-shot demo.
