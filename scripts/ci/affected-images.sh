#!/usr/bin/env bash
# Emits the Docker build matrix for the projects affected in NX_BASE..NX_HEAD —
# the CI counterpart of scripts/k8s/build-images.sh, scoped by `nx affected`
# and project tags (type:service|gateway|mfe-remote|mfe-host|web-ssr). Tag
# filtering naturally excludes libs and the e2e project (no `type:` tag).
#
# Consumed by the `matrix` job in .github/workflows/ci.yml (writes `matrix` +
# `has_images` to $GITHUB_OUTPUT). Also runnable locally for a dry run:
#   NX_BASE=HEAD~1 NX_HEAD=HEAD DOMAIN=staging.example.com bash scripts/ci/affected-images.sh
set -euo pipefail

NX_BASE="${NX_BASE:-origin/main}"
NX_HEAD="${NX_HEAD:-HEAD}"
DOMAIN="${DOMAIN:-lingua.localhost}"
cd "$(dirname "$0")/../.."

# Affected projects carrying the given tag, as a JSON array ([] when none).
affected() {
  local out
  out="$(pnpm exec nx show projects --affected --base="$NX_BASE" --head="$NX_HEAD" \
    -p "tag:$1" --json 2>/dev/null || true)"
  [[ -n "$out" ]] && echo "$out" || echo '[]'
}

DF_SERVICE="infra/docker/Dockerfile.service"
DF_MFE="infra/docker/Dockerfile.mfe"
DF_WEB="infra/docker/Dockerfile.web-public"
BFF="http://api.$DOMAIN"

entries='[]'
add() { # $1=image  $2=dockerfile  $3=build_args(multiline)  $4=target
  entries="$(jq -c \
    --arg image "$1" --arg file "$2" --arg ba "$3" --arg tgt "$4" \
    '. + [{image:$image, file:$file, build_args:$ba, target:$tgt}]' <<<"$entries")"
}

# NestJS services + the gateway → one parameterised Dockerfile (ARG SERVICE).
svc_affected=false
for p in $(affected "type:service" | jq -r '.[]') \
         $(affected "type:gateway" | jq -r '.[]'); do
  add "$p" "$DF_SERVICE" "SERVICE=$p" ""
  svc_affected=true
done

# Shared migrator image (Prisma CLI + full workspace): one image for every
# service, so rebuild it whenever any service/gateway is affected.
if $svc_affected; then
  add "migrator" "$DF_SERVICE" "" "migrator"
fi

# MFE remotes → static nginx image; only BFF_URL is baked.
for p in $(affected "type:mfe-remote" | jq -r '.[]'); do
  add "$p" "$DF_MFE" "$(printf 'PROJECT=%s\nBFF_URL=%s' "$p" "$BFF")" ""
done

# Shell host → also bakes the remote manifest URLs (Module Federation).
for p in $(affected "type:mfe-host" | jq -r '.[]'); do
  add "$p" "$DF_MFE" "$(printf 'PROJECT=%s\nBFF_URL=%s\nMFE_LEARNER_REMOTE=http://mfe-learner.%s/mf-manifest.json\nMFE_SPEAKING_REMOTE=http://mfe-speaking.%s/mf-manifest.json\nMFE_PROGRESS_REMOTE=http://mfe-progress.%s/mf-manifest.json\nMFE_STUDIO_REMOTE=http://mfe-studio.%s/mf-manifest.json' \
    "$p" "$BFF" "$DOMAIN" "$DOMAIN" "$DOMAIN" "$DOMAIN")" ""
done

# Next.js public site → SSR reads env at request time, no build args.
for p in $(affected "type:web-ssr" | jq -r '.[]'); do
  add "$p" "$DF_WEB" "" ""
done

count="$(jq 'length' <<<"$entries")"
matrix="$(jq -c '{include: .}' <<<"$entries")"
has_images="$([[ "$count" -gt 0 ]] && echo true || echo false)"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "matrix=$matrix"
    echo "has_images=$has_images"
  } >>"$GITHUB_OUTPUT"
fi

echo "$matrix" | jq .
echo "affected images: $count (has_images=$has_images)" >&2
