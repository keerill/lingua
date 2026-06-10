# ---------------------------------------------------------------------------
# Outputs → GitHub Secrets/Variables consumed by the `deploy` job in
# .github/workflows/ci.yml. See infra/terraform/README.md for the exact
# `terraform output` → `gh secret set` mapping.
# ---------------------------------------------------------------------------

output "kubeconfig" {
  description = "Raw kubeconfig. Set: terraform output -raw kubeconfig | base64 | gh secret set STAGING_KUBECONFIG"
  value       = module.doks.kubeconfig
  sensitive   = true
}

# --- PostgreSQL ---------------------------------------------------------------
output "database_uris" {
  description = "Per-database Prisma URIs → DATABASE_URL_<DB> secrets."
  value       = module.postgres.connection_uris
  sensitive   = true
}

output "managed_pg_user" {
  description = "→ MANAGED_PG_USER (also Keycloak DB user)."
  value       = module.postgres.user
}

output "managed_pg_password" {
  description = "→ MANAGED_PG_PASSWORD (Keycloak DB password, stored under the POSTGRES_PASSWORD secret key)."
  value       = module.postgres.password
  sensitive   = true
}

output "keycloak_database_url" {
  description = "→ KEYCLOAK_DATABASE_URL."
  value       = module.postgres.keycloak_jdbc_url
}

# --- Kafka + Karapace ---------------------------------------------------------
output "kafka_brokers" {
  description = "→ STAGING_KAFKA_BROKERS."
  value       = module.kafka.brokers
}

output "kafka_sasl_username" {
  description = "→ KAFKA_SASL_USERNAME."
  value       = module.kafka.sasl_username
}

output "kafka_sasl_password" {
  description = "→ KAFKA_SASL_PASSWORD."
  value       = module.kafka.sasl_password
  sensitive   = true
}

output "kafka_ca_cert" {
  description = "Base64 CA. Set: terraform output -raw kafka_ca_cert | base64 -d | gh secret set KAFKA_SSL_CA"
  value       = module.kafka.ca_cert
  sensitive   = true
}

output "schema_registry_uri" {
  description = "→ SCHEMA_REGISTRY_URL (Karapace; SCHEMA_REGISTRY_USER/PASSWORD = the Kafka SASL creds)."
  value       = module.kafka.schema_registry_uri
}

# --- Staging domain ----------------------------------------------------------
output "load_balancer_hint" {
  description = "Point *.<STAGING_DOMAIN> (api/app/www/id/...) at the Traefik LoadBalancer DO provisions for the ingress."
  value       = "kubectl -n lingua get svc -l app.kubernetes.io/name=traefik -o wide"
}
