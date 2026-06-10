output "cluster_id" {
  value = digitalocean_kubernetes_cluster.this.id
}

output "urn" {
  value = digitalocean_kubernetes_cluster.this.urn
}

output "endpoint" {
  value = digitalocean_kubernetes_cluster.this.endpoint
}

output "kubeconfig" {
  description = "Raw kubeconfig — base64 it into the STAGING_KUBECONFIG GitHub Secret."
  value       = digitalocean_kubernetes_cluster.this.kube_config[0].raw_config
  sensitive   = true
}
