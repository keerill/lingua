# Deletes the local k3d cluster (and its registry/volumes) entirely.
param([string]$ClusterName = 'lingua')

$ErrorActionPreference = 'Stop'
k3d cluster delete $ClusterName
