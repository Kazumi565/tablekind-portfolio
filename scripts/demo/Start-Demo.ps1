# Run from ordinary PowerShell. This does not alter the development compose project.
. "$PSScriptRoot/Common.ps1"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Install/start Docker Desktop first.' }
if (-not (Test-Path $DemoEnv)) {
    # Never regenerate passwords for an existing persistent demo database.
    $existing = & docker volume ls --filter 'label=com.docker.compose.project=tablekind-demo' --format '{{.Name}}'
    if ($LASTEXITCODE -ne 0) { throw 'Cannot reach Docker. Start Docker Desktop first.' }
    if ($existing) { throw 'Demo volumes already exist but .env.demo is missing. Restore that file before starting; do not generate new credentials for the old database.' }
    function New-DemoSecret {
        $bytes = New-Object byte[] 32
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        return -join ($bytes | ForEach-Object { $_.ToString('x2') })
    }
    $contents = @(
        '# Private demo only. Do not commit, upload or share this file.'
        "DEMO_DB_PASSWORD=$(New-DemoSecret)"
        "DEMO_JWT_SECRET=$(New-DemoSecret)"
        "DEMO_WEBHOOK_SECRET=$(New-DemoSecret)"
        'DEMO_STAFF_EMAIL=demo@tablekind.local'
        "DEMO_STAFF_PASSWORD=$(New-DemoSecret)"
    ) -join "`n"
    # CreateNew prevents a second startup process overwriting a freshly created file.
    $stream = [System.IO.File]::Open($DemoEnv, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($contents + "`n")
        $stream.Write($bytes, 0, $bytes.Length)
    } finally { $stream.Dispose() }
    Write-Host 'Created private demo credentials. Keep .env.demo for future starts.'
}
# Pause the private sidecar while its shared frontend network namespace may be rebuilt.
Invoke-DemoCompose -Arguments @('stop', 'tailscale')
Invoke-DemoCompose -Arguments @('up', '-d', '--build', '--wait', 'postgres', 'mailpit', 'backend', 'frontend')
Write-Host 'Desktop demo: http://localhost:5180'
Write-Host 'Show sign-in details: .\scripts\demo\Show-DemoLogin.ps1'
Write-Host 'Enable private phone access: .\scripts\demo\Connect-Demo.ps1'
Write-Host 'Local TEST email inbox (desktop only): http://localhost:8026'
Write-Host 'Interfaces: /manage, /staff, /guest. Private operator sign-in: /admin.'
