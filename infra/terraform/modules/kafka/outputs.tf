output "cluster_id" {
  value = digitalocean_database_cluster.kafka.id
}

output "urn" {
  value = digitalocean_database_cluster.kafka.urn
}

# SASL_SSL bootstrap (private VPC endpoint) → KAFKA_BROKERS / STAGING_KAFKA_BROKERS.
output "brokers" {
  value = "${digitalocean_database_cluster.kafka.private_host}:${digitalocean_database_cluster.kafka.port}"
}

output "sasl_username" {
  value = digitalocean_database_user.app.name
}

output "sasl_password" {
  value     = digitalocean_database_user.app.password
  sensitive = true
}

output "ca_cert" {
  description = "Cluster CA (PEM) → KAFKA_SSL_CA."
  value       = data.digitalocean_database_ca.kafka.certificate
  sensitive   = true
}

# Built-in Karapace Schema Registry (same host, SASL creds = the app user).
# Confirm the port/endpoint against the DO control panel.
output "schema_registry_uri" {
  value = "https://${digitalocean_database_cluster.kafka.private_host}:${var.schema_registry_port}"
}
