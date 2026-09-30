param([ValidateSet('local','demo')][string]$Stack='local')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Push-Location $projectRoot
$adminPasswordPointer=[IntPtr]::Zero
try {
    $adminEmail=Read-Host 'Your private administrator email'
    $adminPassword=Read-Host 'A new administrator password (12+ characters)' -AsSecureString
    $adminPasswordPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPassword)
    $adminPasswordText=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminPasswordPointer)
    if ($adminPasswordText -match '[^\x20-\x7E]' -or $adminEmail -match '[^\x20-\x7E]') { throw 'For Windows PowerShell compatibility, use printable ASCII for these provisioning credentials.' }
    if ($adminEmail.Contains("`n") -or $adminPasswordText.Contains("`n") -or $adminPasswordText.Contains("`r")) { throw 'Use single-line credentials.' }
    $composeArgs=@('compose')
    if ($Stack -eq 'demo') {
        if (-not (Test-Path -LiteralPath '.env.demo')) { throw 'Start the private demo with its existing settings first.' }
        $composeArgs+=@('--env-file','.env.demo','-f','compose.demo.yaml')
    }
    # Credentials travel over stdin, never command arguments, environment files or generated source.
    # No service ports are published and no existing container is replaced.
    $composeArgs+=@('run','--rm','--no-deps','-T','backend',
      '--server.port=0','--server.address=127.0.0.1','--tablekind.pos.worker-enabled=false',
      '--tablekind.platform.provision=true','--logging.level.root=ERROR','--spring.main.banner-mode=off')
    $adminInput=$adminEmail+"`n"+$adminPasswordText+"`n"
    $adminInput | & docker @composeArgs
    if ($LASTEXITCODE -ne 0) { throw 'Provisioning failed. The existing administrator, if any, was not replaced.' }
    Write-Host 'Save the displayed authenticator secret and recovery code privately. Do not share this terminal output.'
} finally {
    if ($adminPasswordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminPasswordPointer) }
    $adminInput=$null
    $adminPasswordText=$null
    if ($adminPassword) { $adminPassword.Dispose() }
    Pop-Location
}
