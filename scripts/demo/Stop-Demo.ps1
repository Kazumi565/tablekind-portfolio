. "$PSScriptRoot/Common.ps1"
Assert-DemoEnvironment
Invoke-DemoCompose -Arguments @('stop')
Write-Host 'The private demo is stopped. Its data and credentials are preserved. Development containers are untouched.'
