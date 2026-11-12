param(
    [string]$Source = (Split-Path -Parent $PSScriptRoot)
)
$ErrorActionPreference = 'Stop'
$runId = [Guid]::NewGuid().ToString('N')
$network = 'saqbol-kt-import-check-' + $runId
$db = 'saqbol-kt-import-db-' + $runId
$core = 'saqbol-kt-import-core-' + $runId
$resourceLabel = 'saqbol.kt-import-check=' + $runId
$networkCreated = $false
$dbRequested = $false
$coreRequested = $false
$script = Join-Path $Source 'tests/run_kt_import_concurrency.py'
if (-not (Test-Path -LiteralPath $Source -PathType Container) -or -not (Test-Path -LiteralPath $script -PathType Leaf)) {
    throw 'Explicit source or test script missing.'
}
$Source = (Resolve-Path -LiteralPath $Source).ProviderPath
foreach ($image in @('postgres:15', 'saqbol_lms-core_service:latest')) {
    docker image inspect $image --format '{{.Id}}' 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not inspect existing image: $image. Ensure Docker is accessible and the image is present; this runner never pulls images."
    }
}

function Remove-OwnContainer([string]$Name) {
    $ids = @(docker ps -aq --filter "name=^$Name$" --filter "label=$resourceLabel")
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect this test run containers for cleanup.' }
    foreach ($containerId in $ids) {
        if ($containerId) {
            docker rm -f $containerId | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Could not remove test container $Name." }
        }
    }
}

try {
    docker network create --internal --label $resourceLabel $network | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not create isolated internal network.' }
    $networkCreated = $true
    $dbRequested = $true
    docker run -d --pull never --name $db --label $resourceLabel --network $network --network-alias kt-import-db --read-only --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,size=256m --tmpfs /var/run/postgresql:rw,nosuid,nodev,size=16m --tmpfs /tmp:rw,nosuid,nodev,size=32m --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=saqbol_kt_import_test postgres:15 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not start disposable PostgreSQL.' }
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        docker exec $db pg_isready -U postgres -d saqbol_kt_import_test 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'Disposable PostgreSQL did not become ready.' }
    $coreRequested = $true
    docker run --rm --pull never --name $core --label $resourceLabel --network $network --read-only --tmpfs /tmp:rw,nosuid,nodev,size=256m --mount "type=bind,source=$Source,target=/source,readonly" --entrypoint python saqbol_lms-core_service:latest /source/tests/run_kt_import_concurrency.py
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL KT import assertions failed.' }
} finally {
    try {
        if ($coreRequested) { Remove-OwnContainer $core }
    } finally {
        try {
            if ($dbRequested) { Remove-OwnContainer $db }
        } finally {
            if ($networkCreated) {
                docker network rm $network | Out-Null
                if ($LASTEXITCODE -ne 0) { throw "Could not remove test network $network." }
            }
        }
    }
}
