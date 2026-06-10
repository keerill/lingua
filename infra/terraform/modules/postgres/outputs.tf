locals {
  # Apps reach the cluster over the private VPC network; managed PG mandates TLS.
  base = "postgresql://${digitalocean_database_cluster.pg.user}:${digitalocean_database_cluster.pg.password}@${digitalocean_database_cluster.pg.private_host}:${digitalocean_database_cluster.pg.port}"
}

output "cluster_id" {
  value = digitalocean_database_cluster.pg.id
}

output "urn" {
  value = digitalocean_database_cluster.pg.urn
}

output "user" {
  value = digitalocean_database_cluster.pg.user
}

output "password" {
  value     = digitalocean_database_cluster.pg.password
  sensitive = true
}

# Per-database Prisma connection URIs → the DATABASE_URL_* GitHub Secrets.
output "connection_uris" {
  value     = { for db in var.databases : db => "${local.base}/${db}?sslmode=require" }
  sensitive = true
}

# JDBC form Keycloak needs (no embedded creds; password is passed separately).
output "keycloak_jdbc_url" {
  value = "jdbc:postgresql://${digitalocean_database_cluster.pg.private_host}:${digitalocean_database_cluster.pg.port}/keycloak?sslmode=require"
}
