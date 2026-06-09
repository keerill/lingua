# Brings the whole Lingua stack up in a local k3d cluster:
#   cluster (+ registry, port 80 -> Traefik) -> CoreDNS rewrite -> images ->
#   helm upgrade --install -> smoke checks.
# Idempotent: safe to re-run; existing cluster/registry/release are reused.
#
# Prereqs: Docker Desktop, k3d, helm, kubectl (see README "Kubernetes (k3d)").
param(
    [string]$ClusterName = 'lingua',
    [string]$K3sImage = 'rancher/k3s:v1.36.1-k3s1',
    [string]$Domain = 'lingua.localhost',
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '../..')
Push-Location $repoRoot

try {
    foreach ($tool in 'docker', 'k3d', 'helm', 'kubectl') {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            throw "$tool is required but not on PATH"
        }
    }
    docker info *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Docker engine is not running' }

    # --- cluster -------------------------------------------------------------
    $clusters = k3d cluster list -o json | ConvertFrom-Json
    if ($clusters | Where-Object { $_.name -eq $ClusterName }) {
        Write-Host "==> k3d cluster '$ClusterName' already exists" -ForegroundColor Cyan
    }
    else {
        Write-Host "==> creating k3d cluster '$ClusterName' ($K3sImage)" -ForegroundColor Cyan
        k3d cluster create $ClusterName `
            --image $K3sImage `
            --registry-create "lingua-registry:0.0.0.0:5500" `
            -p '80:80@loadbalancer' `
            --wait
        if ($LASTEXITCODE -ne 0) { throw 'k3d cluster create failed' }
    }

    # --- CoreDNS rewrite: public Keycloak hostname resolvable in-cluster ------
    Write-Host '==> applying CoreDNS rewrite (id.lingua.localhost -> traefik)' -ForegroundColor Cyan
    kubectl apply -f infra/k8s/coredns-custom.yaml
    kubectl -n kube-system rollout restart deployment coredns
    kubectl -n kube-system rollout status deployment coredns --timeout=120s

    # --- images ----------------------------------------------------------------
    if (-not $SkipBuild) {
        & (Join-Path $PSScriptRoot 'build-images.ps1') -Domain $Domain
    }

    # --- helm ------------------------------------------------------------------
    Write-Host '==> helm upgrade --install lingua' -ForegroundColor Cyan
    helm upgrade --install lingua infra/helm/lingua `
        --namespace lingua --create-namespace `
        --set global.domain=$Domain `
        --wait --timeout 20m
    if ($LASTEXITCODE -ne 0) { throw 'helm install failed' }

    # --- smoke checks ------------------------------------------------------------
    Write-Host '==> smoke checks' -ForegroundColor Cyan
    $checks = @(
        @{ Url = "http://api.$Domain/health"; Host = "api.$Domain" },
        @{ Url = "http://app.$Domain/healthz"; Host = "app.$Domain" },
        @{ Url = "http://www.$Domain/"; Host = "www.$Domain" },
        @{ Url = "http://id.$Domain/realms/lingua/.well-known/openid-configuration"; Host = "id.$Domain" }
    )
    $failed = $false
    foreach ($c in $checks) {
        # --resolve: plain curl does not necessarily resolve *.localhost on Windows.
        $code = curl.exe -s -o NUL -w '%{http_code}' --resolve "$($c.Host):80:127.0.0.1" --max-time 15 $c.Url
        if ($code -eq '200') {
            Write-Host "  OK  $($c.Url)" -ForegroundColor Green
        }
        else {
            Write-Host "  FAIL($code) $($c.Url)" -ForegroundColor Red
            $failed = $true
        }
    }
    if ($failed) { throw 'smoke checks failed — inspect: kubectl -n lingua get pods' }

    Write-Host ''
    Write-Host "Lingua is up: http://app.$Domain (learner/learner, admin/admin)" -ForegroundColor Green
}
finally {
    Pop-Location
}
