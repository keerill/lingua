# 15 — Terraform (DigitalOcean staging infrastructure)

This document explains how Lingua provisions its cloud staging environment — a Kubernetes
cluster plus managed PostgreSQL and Kafka on DigitalOcean — using **Terraform**, and how the
values it produces flow into the GitHub Secrets that the CI deploy job needs. Everything lives
under [infra/terraform](../infra/terraform).

> **This costs real money.** Unlike the local k3d cluster, this provisions live cloud resources
> on a real DigitalOcean account. The stack (DOKS + managed PostgreSQL + 3-node managed Kafka)
> runs to a few hundred USD/month. Run `terraform destroy` when the demo is done.

## What is it

### Infrastructure as code

You *could* create a Kubernetes cluster and databases by clicking around a cloud provider's web
console. That works once, but it is not repeatable, not reviewable, and easy to get subtly
wrong. **Infrastructure as code (IaC)** means describing your servers, databases, and networks
in text files, checked into git, so the infrastructure is created by running a tool instead of
by clicking — repeatable, reviewable, and version-controlled like any other code.

### Terraform

**Terraform** (by HashiCorp; OpenTofu is a compatible fork) is the most common IaC tool. You
describe the *desired* state and Terraform figures out the API calls to make reality match.
Core concepts:

- **Provider** — a plugin that knows how to talk to one platform's API. Lingua uses the
  `digitalocean/digitalocean` provider, pinned in
  [infra/terraform/versions.tf](../infra/terraform/versions.tf).
- **Resource** — one piece of infrastructure: a `digitalocean_kubernetes_cluster`, a
  `digitalocean_database_cluster`, a VPC. You declare it; Terraform creates/updates/deletes it.
- **Variable** — a typed input (region, node count, sizes) so the same code can produce
  different environments. Defined in
  [infra/terraform/variables.tf](../infra/terraform/variables.tf), supplied via a
  `-var-file`.
- **Output** — a value Terraform *returns* after building (a connection string, a kubeconfig).
  Lingua's outputs are the bridge to CI — see below.
- **Module** — a reusable, parameterised bundle of resources, like a function. Lingua has three:
  `doks`, `postgres`, `kafka`.
- **State** — Terraform records what it created in a `terraform.tfstate` file, so it knows the
  difference between "create new" and "update existing". By default this is a local file; for a
  team you keep it in shared remote storage (a commented-out DO Spaces backend ships in
  `versions.tf`).
- **plan / apply / destroy** — `plan` shows what *would* change, `apply` makes it so, `destroy`
  tears it all down.

### Managed vs self-hosted, and why staging uses managed

For databases and Kafka you have two choices:

- **Self-hosted** — you run PostgreSQL/Kafka yourself (e.g. as pods in the cluster). Cheap and
  fine for local development; *you* are responsible for backups, failover, upgrades, and TLS.
- **Managed** — the cloud provider runs them for you, with automated backups, patching, high
  availability, and enforced TLS. Costs more, but is far less to operate.

Lingua's *local* stack (k3d) self-hosts everything in-cluster. **Staging uses managed**
PostgreSQL and Kafka, because staging is meant to resemble production — you want the durability
and TLS guarantees of a managed service, and you do not want to babysit a database in a demo
environment. The Helm overrides in
[infra/helm/lingua/values-staging.yaml](../infra/helm/lingua/values-staging.yaml) reflect this:
the in-cluster `postgres` and `kafka` subcharts are turned **off**, and the apps are pointed at
the managed endpoints Terraform created.

## How Lingua uses it

The root configuration is [infra/terraform/main.tf](../infra/terraform/main.tf). It wires up a
private network and three modules, then locks the data services down to the cluster:

```
VPC ── DOKS (Kubernetes 1.36)        → Helm deploys the apps here (CI deploy job)
    ├─ Managed PostgreSQL            → 7 app DBs + keycloak
    └─ Managed Kafka + Karapace      → event bus + Schema Registry
```

`main.tf` creates a `digitalocean_vpc` (a private network), passes its id into all three
modules so the apps reach the databases over private networking, adds a
`digitalocean_database_firewall` for both PostgreSQL and Kafka restricting access to the DOKS
cluster only, and groups everything under one `digitalocean_project` for tidiness.

### The `doks` module — the Kubernetes cluster

[infra/terraform/modules/doks](../infra/terraform/modules/doks) creates a
`digitalocean_kubernetes_cluster`. Because DigitalOcean pins exact patch versions (e.g.
`1.36.1-do.0`), it uses a `digitalocean_kubernetes_versions` data source with a
`version_prefix` of `1.36.` to pick the latest patch automatically. It provisions one node pool
(default 3 × `s-2vcpu-4gb`). Its most important output is **`kubeconfig`** — the raw cluster
credentials that CI base64-encodes into the `STAGING_KUBECONFIG` secret so the deploy job can
talk to the cluster.

### The `postgres` module — managed PostgreSQL

[infra/terraform/modules/postgres](../infra/terraform/modules/postgres) creates one
`digitalocean_database_cluster` (engine `pg`) and then a `digitalocean_database_db` for each
name in the `databases` variable — seven app databases plus `keycloak` (mirroring the local
`init-databases.sh`). Its outputs build the connection strings the apps need:

- `connection_uris` — a map of `{ <db> => postgresql://...@<private-host>:<port>/<db>?sslmode=require }`,
  one per database (TLS is mandatory on managed PG). These become the `DATABASE_URL_*` secrets.
- `user` / `password` — the cluster admin (also reused as the Keycloak DB user).
- `keycloak_jdbc_url` — the JDBC form Keycloak expects, with no embedded credentials.

### The `kafka` module — managed Kafka + Karapace

[infra/terraform/modules/kafka](../infra/terraform/modules/kafka) creates a
`digitalocean_database_cluster` (engine `kafka`, ≥ 3 nodes as DO requires), a
`digitalocean_database_user` (the SASL/SCRAM user the services authenticate as), and a
`digitalocean_database_kafka_topic` for each event topic in the `topics` variable (mirroring
the Helm Kafka values; 3 partitions each, as managed Kafka requires). A
`digitalocean_database_ca` data source reads the cluster CA. Its outputs:

- `brokers` — the SASL_SSL bootstrap endpoint (private host:port) → `STAGING_KAFKA_BROKERS`.
- `sasl_username` / `sasl_password` → `KAFKA_SASL_USERNAME` / `KAFKA_SASL_PASSWORD`.
- `ca_cert` — the cluster CA in PEM → `KAFKA_SSL_CA` (so the apps trust the broker's TLS).
- `schema_registry_uri` — the built-in **Karapace** Schema Registry endpoint (Confluent-API
  compatible). Its basic-auth credentials are the same Kafka SASL creds.

### Outputs → GitHub Secrets → the deploy job

This is the crucial link. The CI `deploy` job (see [./14-ci-cd.md](./14-ci-cd.md)) does not
invent its connection strings — it reads them from GitHub Secrets that *you* populate from
Terraform outputs. [infra/terraform/outputs.tf](../infra/terraform/outputs.tf) re-exports the
module outputs at the root and documents, in each description, which secret it maps to. For
example `database_uris` → the `DATABASE_URL_*` secrets, `kubeconfig` → `STAGING_KUBECONFIG`,
`kafka_brokers` → `STAGING_KAFKA_BROKERS`, `schema_registry_uri` → `SCHEMA_REGISTRY_URL`.

The exact `terraform output … | gh secret set …` mapping lives in
[infra/terraform/README.md](../infra/terraform/README.md) and is summarised under *See it in
action*. Once those secrets exist and you set `STAGING_ENABLED=true`, the gated `deploy` job in
CI starts running.

## Key files

- [infra/terraform/main.tf](../infra/terraform/main.tf) — root config: VPC, the three modules,
  database firewalls, and the DO project.
- [infra/terraform/variables.tf](../infra/terraform/variables.tf) — all inputs (region, sizes,
  versions, the database and topic lists) with defaults.
- [infra/terraform/outputs.tf](../infra/terraform/outputs.tf) — the values that feed GitHub
  Secrets; each description names its target secret.
- [infra/terraform/versions.tf](../infra/terraform/versions.tf) — required Terraform/provider
  versions and the (commented) remote-state backend.
- [infra/terraform/modules/doks](../infra/terraform/modules/doks) — the DOKS cluster module.
- [infra/terraform/modules/postgres](../infra/terraform/modules/postgres) — managed PostgreSQL
  + the per-database connection URIs.
- [infra/terraform/modules/kafka](../infra/terraform/modules/kafka) — managed Kafka, topics,
  SASL user, CA, and Karapace endpoint.
- [infra/terraform/staging.tfvars.example](../infra/terraform/staging.tfvars.example) — copy to
  `staging.tfvars` and edit region/sizes.
- [infra/terraform/README.md](../infra/terraform/README.md) — the full apply + secrets-wiring
  runbook.
- [infra/helm/lingua/values-staging.yaml](../infra/helm/lingua/values-staging.yaml) — how the
  Helm release switches from in-cluster data services to the managed endpoints.

## See it in action

> These commands provision **real, paid** cloud resources. You need a DigitalOcean account and
> an API token.

**Provision the stack:**

```bash
cd infra/terraform
export DIGITALOCEAN_TOKEN=dop_v1_...           # the DO API token
cp staging.tfvars.example staging.tfvars       # edit region/sizes if needed
terraform init                                 # download the DO provider
terraform plan  -var-file=staging.tfvars       # preview what will be created
terraform apply -var-file=staging.tfvars       # create it (asks for confirmation)
```

**Wire the outputs into GitHub Secrets** (the deploy job reads these). A few representative
mappings — the full list is in the README:

```bash
terraform output -raw kubeconfig | base64 | gh secret set STAGING_KUBECONFIG

# one DATABASE_URL_<DB> per app database
for db in IDENTITY VOCABULARY LEARNING DIALOG CONTENT PROGRESS NOTIFICATIONS; do
  terraform output -json database_uris | jq -r ".$(echo $db | tr A-Z a-z)" \
    | gh secret set "DATABASE_URL_$db"
done

terraform output -raw kafka_brokers       | gh secret set STAGING_KAFKA_BROKERS
terraform output -raw kafka_ca_cert | base64 -d | gh secret set KAFKA_SSL_CA
terraform output -raw schema_registry_uri | gh secret set SCHEMA_REGISTRY_URL

# finally, flip the deploy switch
gh variable set STAGING_ENABLED --body true
gh variable set STAGING_DOMAIN  --body staging.lingua.example.com
```

**Find the ingress IP** so you can point DNS at it (DOKS provisions a LoadBalancer for Traefik
after the first deploy):

```bash
kubectl -n lingua get svc -l app.kubernetes.io/name=traefik -o wide
```

Point `*.<STAGING_DOMAIN>` (at least `api`, `app`, `www`, `id`, `mfe-*`) at that IP. Note that
frontends bake the domain at build time, so `STAGING_DOMAIN` must match what the CI Docker
matrix used.

**Tear it all down when the demo is over:**

```bash
terraform destroy -var-file=staging.tfvars
```

## Related

- [./14-ci-cd.md](./14-ci-cd.md) — the deploy job that consumes these outputs, and the
  `STAGING_ENABLED` gate.
- [./12-kubernetes-helm.md](./12-kubernetes-helm.md) — the Helm chart deployed onto the DOKS
  cluster, and how `values-staging.yaml` overrides the local defaults.
- [./04-data-prisma.md](./04-data-prisma.md) — the per-service databases behind the
  `DATABASE_URL_*` connection strings.
- [./05-messaging-kafka.md](./05-messaging-kafka.md) — the event topics and SASL/SSL auth the
  managed Kafka module configures.
- [./07-auth-keycloak.md](./07-auth-keycloak.md) — Keycloak, which runs in-cluster against the
  managed `keycloak` database.
