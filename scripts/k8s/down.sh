#!/usr/bin/env bash
# Deletes the local k3d cluster (and its registry/volumes) entirely.
set -euo pipefail
k3d cluster delete "${CLUSTER_NAME:-lingua}"
