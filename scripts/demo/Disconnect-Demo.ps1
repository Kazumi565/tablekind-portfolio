. "$PSScriptRoot/Common.ps1"
Assert-DemoEnvironment
Invoke-DemoCompose -Arguments @('exec', 'tailscale', 'tailscale', 'serve', '--https=443', 'off')
Write-Host 'Private HTTPS access is off. The desktop demo at localhost:5180 is still available.'
