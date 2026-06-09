#!/usr/bin/env bash
# Builds every Lingua image and pushes it to the k3d-managed registry
# (localhost:5500 on the host = k3d-lingua-registry:5500 inside the cluster).
# Usage:
#   ./scripts/k8s/build-images.sh             # build + push everything
#   RESTART=1 ./scripts/k8s/build-images.sh   # ...then restart the deployments
set -euo pipefail

DOMAIN="${DOMAIN:-lingua.localhost}"
REGISTRY="${REGISTRY:-localhost:5500}"
TAG="${TAG:-dev}"
cd "$(dirname "$0")/../.."

build_and_push() {
  local name="$1"; shift
  local image="$REGISTRY/lingua/$name:$TAG"
  echo "==> building $image"
  docker build "$@" -t "$image" .
  docker push "$image"
}

# Backend NestJS services (one parameterised Dockerfile).
for s in gateway-bff svc-identity svc-vocabulary svc-learning \
         svc-ai-dialog svc-speech svc-content svc-progress svc-notifications; do
  build_and_push "$s" -f infra/docker/Dockerfile.service --build-arg "SERVICE=$s"
done

# Shared migrator image (Prisma CLI + full workspace) for migrate/seed Jobs.
build_and_push migrator -f infra/docker/Dockerfile.service --target migrator

# Static frontends: URLs are baked at build time.
BFF="http://api.$DOMAIN"
for m in mfe-learner mfe-speaking mfe-progress mfe-studio; do
  build_and_push "$m" -f infra/docker/Dockerfile.mfe \
    --build-arg "PROJECT=$m" --build-arg "BFF_URL=$BFF"
done
build_and_push shell -f infra/docker/Dockerfile.mfe \
  --build-arg PROJECT=shell --build-arg "BFF_URL=$BFF" \
  --build-arg "MFE_LEARNER_REMOTE=http://mfe-learner.$DOMAIN/mf-manifest.json" \
  --build-arg "MFE_SPEAKING_REMOTE=http://mfe-speaking.$DOMAIN/mf-manifest.json" \
  --build-arg "MFE_PROGRESS_REMOTE=http://mfe-progress.$DOMAIN/mf-manifest.json" \
  --build-arg "MFE_STUDIO_REMOTE=http://mfe-studio.$DOMAIN/mf-manifest.json"

# Next.js public site (SSR; env is read at runtime, no URL build args).
build_and_push web-public -f infra/docker/Dockerfile.web-public

if [[ "${RESTART:-0}" == "1" ]]; then
  echo '==> restarting deployments'
  kubectl -n lingua rollout restart deployment
fi
echo 'all images built and pushed'
