terraform {
  required_providers {
    digitalocean = {
      source = "digitalocean/digitalocean"
    }
  }
}

resource "digitalocean_database_cluster" "pg" {
  name                 = var.name
  engine               = "pg"
  version              = var.engine_version
  size                 = var.size
  region               = var.region
  node_count           = var.node_count
  private_network_uuid = var.vpc_uuid
}

resource "digitalocean_database_db" "dbs" {
  for_each   = toset(var.databases)
  cluster_id = digitalocean_database_cluster.pg.id
  name       = each.value
}
