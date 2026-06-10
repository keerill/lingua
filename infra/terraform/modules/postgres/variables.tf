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

variable "databases" {
  type = list(string)
}
