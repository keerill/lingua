# Builds every Lingua image and pushes it to the k3d-managed registry
# (localhost:5500 on the host = k3d-lingua-registry:5500 inside the cluster).
# Usage:
#   ./scripts/k8s/build-images.ps1            # build + push everything
#   ./scripts/k8s/build-images.ps1 -Restart   # ...then restart the deployments
param(
    [switch]$Restart,
    [string]$Domain = 'lingua.localhost',
    [string]$Registry = 'localhost:5500',
    [string]$Tag = 'dev'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '../..')
Push-Location $repoRoot

function Build-And-Push {
    param([string]$Name, [string[]]$BuildArgs)
    $image = "$Registry/lingua/${Name}:$Tag"
    Write-Host "==> building $image" -ForegroundColor Cyan
    docker build @BuildArgs -t $image .
    if ($LASTEXITCODE -ne 0) { throw "docker build failed for $Name" }
    docker push $image
    if ($LASTEXITCODE -ne 0) { throw "docker push failed for $Name" }
}

try {
    # Backend NestJS services (one parameterised Dockerfile).
    $services = 'gateway-bff', 'svc-identity', 'svc-vocabulary', 'svc-learning',
                'svc-ai-dialog', 'svc-speech', 'svc-content', 'svc-progress', 'svc-notifications'
    foreach ($s in $services) {
        Build-And-Push $s @('-f', 'infra/docker/Dockerfile.service', '--build-arg', "SERVICE=$s")
    }

    # Shared migrator image (Prisma CLI + full workspace) for migrate/seed Jobs.
    Build-And-Push 'migrator' @('-f', 'infra/docker/Dockerfile.service', '--target', 'migrator')

    # Static frontends: URLs are baked at build time.
    $bff = "http://api.$Domain"
    foreach ($m in 'mfe-learner', 'mfe-speaking', 'mfe-progress', 'mfe-studio') {
        Build-And-Push $m @('-f', 'infra/docker/Dockerfile.mfe',
            '--build-arg', "PROJECT=$m", '--build-arg', "BFF_URL=$bff")
    }
    Build-And-Push 'shell' @('-f', 'infra/docker/Dockerfile.mfe',
        '--build-arg', 'PROJECT=shell', '--build-arg', "BFF_URL=$bff",
        '--build-arg', "MFE_LEARNER_REMOTE=http://mfe-learner.$Domain/mf-manifest.json",
        '--build-arg', "MFE_SPEAKING_REMOTE=http://mfe-speaking.$Domain/mf-manifest.json",
        '--build-arg', "MFE_PROGRESS_REMOTE=http://mfe-progress.$Domain/mf-manifest.json",
        '--build-arg', "MFE_STUDIO_REMOTE=http://mfe-studio.$Domain/mf-manifest.json")

    # Next.js public site (SSR; env is read at runtime, no URL build args).
    Build-And-Push 'web-public' @('-f', 'infra/docker/Dockerfile.web-public')

    if ($Restart) {
        Write-Host '==> restarting deployments' -ForegroundColor Cyan
        kubectl -n lingua rollout restart deployment
    }
    Write-Host 'all images built and pushed' -ForegroundColor Green
}
finally {
    Pop-Location
}
