param(
    [string]$Source = (Split-Path -Parent $PSScriptRoot),
    [switch]$KtProfile
)
$ErrorActionPreference = 'Stop'
$runId = [Guid]::NewGuid().ToString('N').Substring(0, 12)
$network = 'saqbol-idempotency-check-' + $runId
$db = 'saqbol-idempotency-db-' + $runId
$core = 'saqbol-idempotency-core-' + $runId
$networkCreated = $false
$dbRequested = $false
$coreRequested = $false
$script = Join-Path $Source 'tests/run_submission_concurrency.py'
if (-not (Test-Path -LiteralPath $Source -PathType Container) -or -not (Test-Path -LiteralPath $script -PathType Leaf)) { throw 'Explicit source or test script missing.' }
try {
    docker network create --internal $network | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not create isolated internal network.' }
    $networkCreated = $true
    $dbRequested = $true
    docker run -d --pull never --name $db --network $network --network-alias idempotency-db --read-only --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,size=256m --tmpfs /var/run/postgresql:rw,nosuid,nodev,size=16m --tmpfs /tmp:rw,nosuid,nodev,size=32m --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=saqbol_idempotency_test postgres:15 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not start disposable PostgreSQL.' }
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        docker exec $db pg_isready -U postgres -d saqbol_idempotency_test 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'Disposable PostgreSQL did not become ready.' }
    $coreRequested = $true
    $runnerArgs = @()
    if ($KtProfile) { $runnerArgs += '--kt' }
    docker run --rm --pull never --name $core --network $network --read-only --tmpfs /tmp:rw,nosuid,nodev,size=256m --mount "type=bind,source=$Source,target=/source,readonly" --entrypoint python saqbol_lms-core_service:latest /source/tests/run_submission_concurrency.py @runnerArgs
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL concurrency assertions failed.' }
} finally {
    try {
        if ($coreRequested -and (docker ps -aq --filter "name=^$core$")) { docker rm -f $core | Out-Null }
    } finally {
        try {
            if ($dbRequested -and (docker ps -aq --filter "name=^$db$")) { docker rm -f $db | Out-Null }
        } finally {
            if ($networkCreated) { docker network rm $network | Out-Null }
        }
    }
}
