Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$DemoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$DemoEnv = Join-Path $DemoRoot '.env.demo'

function Invoke-DemoCompose {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    & docker compose --project-name tablekind-demo --env-file $DemoEnv -f (Join-Path $DemoRoot 'compose.demo.yaml') --profile private @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Demo command failed (exit $LASTEXITCODE). See the output above." }
}

function Assert-DemoEnvironment {
    if (-not (Test-Path $DemoEnv)) { throw 'Run scripts/demo/Start-Demo.ps1 first.' }
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Start Docker Desktop and make sure docker is on PATH.' }
}
