terraform {
  required_providers {
    digitalocean = {
      source = "digitalocean/digitalocean"
    }
  }
}

# DO pins exact patches (e.g. 1.36.1-do.0); pick the latest for the minor.
data "digitalocean_kubernetes_versions" "this" {
  version_prefix = var.version_prefix
}

resource "digitalocean_kubernetes_cluster" "this" {
  name     = var.name
  region   = var.region
  version  = data.digitalocean_kubernetes_versions.this.latest_version
  vpc_uuid = var.vpc_uuid

  node_pool {
    name       = "default"
    size       = var.node_size
    node_count = var.node_count
  }
}
