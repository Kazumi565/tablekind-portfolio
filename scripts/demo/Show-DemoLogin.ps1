. "$PSScriptRoot/Common.ps1"
Assert-DemoEnvironment
# Only display the app login locally, never database or signing secrets.
Get-Content $DemoEnv | Where-Object { $_ -match '^DEMO_STAFF_(EMAIL|PASSWORD)=' } | ForEach-Object { Write-Host $_ }
Write-Host 'Share only this demo login privately. Never send the whole .env.demo file.'
