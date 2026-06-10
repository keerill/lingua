terraform {
  required_providers {
    digitalocean = {
      source = "digitalocean/digitalocean"
    }
  }
}

resource "digitalocean_database_cluster" "kafka" {
  name                 = var.name
  engine               = "kafka"
  version              = var.engine_version
  size                 = var.size
  region               = var.region
  node_count           = var.node_count
  private_network_uuid = var.vpc_uuid
}

# SASL/SCRAM user the Lingua services authenticate as (DO also issues mTLS certs;
# libs/kafka uses SASL_SSL). The user's password is the SASL password.
resource "digitalocean_database_user" "app" {
  cluster_id = digitalocean_database_cluster.kafka.id
  name       = var.app_user
}

resource "digitalocean_database_kafka_topic" "topics" {
  for_each   = toset(var.topics)
  cluster_id = digitalocean_database_cluster.kafka.id
  name       = each.value
  # DO Managed Kafka requires >= 3 partitions (the in-cluster k3d broker uses 1).
  partition_count    = 3
  replication_factor = min(var.node_count, 3)
}

# Cluster CA — the apps trust it via KAFKA_SSL_CA.
data "digitalocean_database_ca" "kafka" {
  cluster_id = digitalocean_database_cluster.kafka.id
}
