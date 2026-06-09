#!/usr/bin/env bash
# Brings the whole Lingua stack up in a local k3d cluster:
#   cluster (+ registry, port 80 -> Traefik) -> CoreDNS rewrite -> images ->
#   helm upgrade --install -> smoke checks.
# Idempotent: safe to re-run; existing cluster/registry/release are reused.
#
# Prereqs: Docker, k3d, helm, kubectl (see README "Kubernetes (k3d)").
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-lingua}"
K3S_IMAGE="${K3S_IMAGE:-rancher/k3s:v1.36.1-k3s1}"
DOMAIN="${DOMAIN:-lingua.localhost}"
SKIP_BUILD="${SKIP_BUILD:-0}"
cd "$(dirname "$0")/../.."

for tool in docker k3d helm kubectl; do
  command -v "$tool" >/dev/null || { echo "$tool is required but not on PATH"; exit 1; }
done
docker info >/dev/null

# --- cluster -----------------------------------------------------------------
if k3d cluster list -o json | grep -q "\"name\":\"$CLUSTER_NAME\""; then
  echo "==> k3d cluster '$CLUSTER_NAME' already exists"
else
  echo "==> creating k3d cluster '$CLUSTER_NAME' ($K3S_IMAGE)"
  k3d cluster create "$CLUSTER_NAME" \
    --image "$K3S_IMAGE" \
    --registry-create "lingua-registry:0.0.0.0:5500" \
    -p '80:80@loadbalancer' \
    --wait
fi

# --- CoreDNS rewrite: public Keycloak hostname resolvable in-cluster -----------
echo '==> applying CoreDNS rewrite (id.lingua.localhost -> traefik)'
kubectl apply -f infra/k8s/coredns-custom.yaml
kubectl -n kube-system rollout restart deployment coredns
kubectl -n kube-system rollout status deployment coredns --timeout=120s

# --- images --------------------------------------------------------------------
if [[ "$SKIP_BUILD" != "1" ]]; then
  DOMAIN="$DOMAIN" ./scripts/k8s/build-images.sh
fi

# --- helm ------------------------------------------------------------------------
echo '==> helm upgrade --install lingua'
helm upgrade --install lingua infra/helm/lingua \
  --namespace lingua --create-namespace \
  --set "global.domain=$DOMAIN" \
  --wait --timeout 20m

# --- smoke checks ------------------------------------------------------------------
echo '==> smoke checks'
fail=0
check() {
  local host="$1" path="$2"
  local code
  # --resolve: *.localhost does not necessarily resolve outside browsers.
  code="$(curl -s -o /dev/null -w '%{http_code}' --resolve "$host:80:127.0.0.1" --max-time 15 "http://$host$path")"
  if [[ "$code" == "200" ]]; then
    echo "  OK  http://$host$path"
  else
    echo "  FAIL($code) http://$host$path"
    fail=1
  fi
}
check "api.$DOMAIN" /health
check "app.$DOMAIN" /healthz
check "www.$DOMAIN" /
check "id.$DOMAIN" /realms/lingua/.well-known/openid-configuration
[[ "$fail" == "0" ]] || { echo 'smoke checks failed — inspect: kubectl -n lingua get pods'; exit 1; }

echo
echo "Lingua is up: http://app.$DOMAIN (learner/learner, admin/admin)"
