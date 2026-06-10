variable "do_token" {
  description = "DigitalOcean API token (or set DIGITALOCEAN_TOKEN)."
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Environment name; prefixes every resource and sets the DO project environment."
  type        = string
  default     = "staging"
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "environment must be one of: development, staging, production."
  }
}

variable "region" {
  description = "DigitalOcean region slug (e.g. fra1, nyc3, ams3)."
  type        = string
  default     = "fra1"
}

# --- DOKS ---------------------------------------------------------------------
variable "kubernetes_version_prefix" {
  description = "Match the latest DOKS patch for this minor."
  type        = string
  default     = "1.36."
}

variable "node_size" {
  description = "Droplet size for the DOKS node pool."
  type        = string
  default     = "s-2vcpu-4gb"
}

variable "node_count" {
  description = "DOKS node pool size."
  type        = number
  default     = 3
}

# --- Managed PostgreSQL -------------------------------------------------------
variable "pg_version" {
  type    = string
  default = "17"
}

variable "pg_size" {
  type    = string
  default = "db-s-1vcpu-2gb"
}

variable "pg_node_count" {
  type    = number
  default = 1
}

variable "databases" {
  description = "Logical databases to create (7 app DBs + keycloak). Mirrors infra/docker/postgres/init-databases.sh."
  type        = list(string)
  default = [
    "identity",
    "vocabulary",
    "learning",
    "dialog",
    "content",
    "progress",
    "notifications",
    "keycloak",
  ]
}

# --- Managed Kafka ------------------------------------------------------------
variable "kafka_version" {
  type    = string
  default = "3.7"
}

variable "kafka_size" {
  type    = string
  default = "db-s-2vcpu-2gb"
}

variable "kafka_node_count" {
  description = "DO Managed Kafka requires at least 3 nodes."
  type        = number
  default     = 3
}

variable "kafka_app_user" {
  description = "Kafka SASL/SCRAM user the Lingua services authenticate as."
  type        = string
  default     = "lingua-app"
}

variable "topics" {
  description = "Event topics to pre-create. Mirrors infra/helm/lingua/charts/kafka/values.yaml."
  type        = list(string)
  default = [
    "vocabulary.card.created",
    "learning.review.completed",
    "speaking.mistake.detected",
    "vocabulary.cards.flagged",
    "content.scenario.updated",
    "notification.sent",
  ]
}

variable "schema_registry_port" {
  description = "Karapace Schema Registry port on the managed Kafka host. Verify against the DO control panel."
  type        = number
  default     = 25073
}
