param(
    [Parameter(Mandatory = $true)][string]$OwnerEmail,
    [Parameter(Mandatory = $true)][string]$DiegoEmail
)
. "$PSScriptRoot/Common.ps1"
Assert-DemoEnvironment
foreach ($email in @($OwnerEmail, $DiegoEmail)) {
    $parsed = [System.Net.Mail.MailAddress]::new($email)
    if ($parsed.Address -ne $email) { throw 'Use the exact Tailscale sign-in email, without a display name.' }
}
$ip = Invoke-DemoCompose -Arguments @('exec', '-T', 'tailscale', 'tailscale', 'ip', '-4')
$ip = ($ip -join '').Trim()
if ($ip -notmatch '^100\.(\d{1,3}\.){2}\d{1,3}$') { throw 'Could not read the demo Tailscale IPv4 address. Connect the demo first.' }
$policy = @{
    grants = @(
        @{ src = @($OwnerEmail); dst = @($ip); ip = @('tcp:443') }
        @{ src = @($DiegoEmail); dst = @($ip); ip = @('tcp:443') }
    )
}
Write-Host 'Policy for a NEW, DEDICATED demo tailnet only. Review it in the Tailscale policy editor.'
Write-Host 'Do not replace an existing work/personal network policy with this. Broad existing grants remain additive.'
$policy | ConvertTo-Json -Depth 8
