# ---------------------------------------------------------------------------
# Lingua — managed demo infrastructure on DigitalOcean.
#
#   VPC ── DOKS (k8s 1.36)          → Helm deploys the apps here (CI deploy job)
#       ├─ Managed PostgreSQL       → 7 app DBs + keycloak
#       └─ Managed Kafka + Karapace → event bus + Schema Registry
#
# Outputs feed the GitHub Secrets the deploy job consumes (see outputs.tf and
# infra/terraform/README.md). Apps reach PG/Kafka over the private VPC network.
# ---------------------------------------------------------------------------

locals {
  name_prefix = "lingua-${var.environment}"
}

resource "digitalocean_vpc" "lingua" {
  name   = "${local.name_prefix}-vpc"
  region = var.region
}

module "doks" {
  source         = "./modules/doks"
  name           = "${local.name_prefix}-doks"
  region         = var.region
  vpc_uuid       = digitalocean_vpc.lingua.id
  version_prefix = var.kubernetes_version_prefix
  node_size      = var.node_size
  node_count     = var.node_count
}

module "postgres" {
  source         = "./modules/postgres"
  name           = "${local.name_prefix}-pg"
  region         = var.region
  vpc_uuid       = digitalocean_vpc.lingua.id
  engine_version = var.pg_version
  size           = var.pg_size
  node_count     = var.pg_node_count
  databases      = var.databases
}

module "kafka" {
  source               = "./modules/kafka"
  name                 = "${local.name_prefix}-kafka"
  region               = var.region
  vpc_uuid             = digitalocean_vpc.lingua.id
  engine_version       = var.kafka_version
  size                 = var.kafka_size
  node_count           = var.kafka_node_count
  topics               = var.topics
  app_user             = var.kafka_app_user
  schema_registry_port = var.schema_registry_port
}

# Lock the managed databases down to the DOKS cluster (private VPC + firewall).
resource "digitalocean_database_firewall" "pg" {
  cluster_id = module.postgres.cluster_id
  rule {
    type  = "k8s"
    value = module.doks.cluster_id
  }
}

resource "digitalocean_database_firewall" "kafka" {
  cluster_id = module.kafka.cluster_id
  rule {
    type  = "k8s"
    value = module.doks.cluster_id
  }
}

# Group everything under one DO project for tidiness in the console.
resource "digitalocean_project" "lingua" {
  name        = local.name_prefix
  description = "Lingua ${var.environment} — managed demo"
  purpose     = "Web Application"
  environment = title(var.environment)
  resources = [
    module.doks.urn,
    module.postgres.urn,
    module.kafka.urn,
  ]
}
