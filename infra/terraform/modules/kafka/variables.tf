variable "name" {
  type = string
}

variable "region" {
  type = string
}

variable "vpc_uuid" {
  type = string
}

variable "engine_version" {
  type = string
}

variable "size" {
  type = string
}

variable "node_count" {
  type = number
}

variable "topics" {
  type = list(string)
}

variable "app_user" {
  type = string
}

variable "schema_registry_port" {
  type = number
}
