. "$PSScriptRoot/Common.ps1"
Assert-DemoEnvironment
Invoke-DemoCompose -Arguments @('up', '-d', '--force-recreate', '--wait', 'tailscale')
Write-Host 'Open the Tailscale login URL below and approve this demo device with your account.'
Invoke-DemoCompose -Arguments @('exec', 'tailscale', 'tailscale', 'up', '--hostname=tablekind-demo', '--accept-dns=false', '--timeout=5m')
Write-Host 'If Tailscale asks you to enable HTTPS, open its URL, enable HTTPS, then run this script again.'
Invoke-DemoCompose -Arguments @('exec', 'tailscale', 'tailscale', 'serve', '--bg', '--https=443', 'http://127.0.0.1:8080')
Invoke-DemoCompose -Arguments @('exec', 'tailscale', 'tailscale', 'serve', 'status')
Write-Host 'Next: use docs/PRIVATE_DEMO.md to restrict access and share only this demo device with Diego.'
Write-Host 'Do not enable Funnel. The phone must be connected to Tailscale.'
