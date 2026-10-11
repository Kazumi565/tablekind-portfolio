$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$configPath = Join-Path $projectRoot '.env.hackathon'
if (Test-Path -LiteralPath $configPath) { throw 'Configuration already exists. Edit .env.hackathon without replacing its database credentials.' }
function New-LocalSecret {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}
$lines = @(
  'HACKATHON_DB_PASSWORD=' + (New-LocalSecret)
  'HACKATHON_JWT_SECRET=' + (New-LocalSecret)
  'HACKATHON_STAFF_EMAIL=manager@tablekind.test'
  'HACKATHON_STAFF_PASSWORD=' + (New-LocalSecret)
  'HACKATHON_PORT=5195'
  'HACKATHON_APP_URL=http://localhost:5195'
  'PAYPAL_CLIENT_ID='
  'PAYPAL_CLIENT_SECRET='
  'PAYPAL_MERCHANT_ID='
  'AI_CALLS_ENABLED=false'
  'OPENAI_API_KEY='
  'AI_MODEL=gpt-6.1-sol'
  'AI_REASONING_EFFORT=low'
  'AI_MAX_CALLS=0'
)
[IO.File]::WriteAllLines($configPath, $lines, (New-Object Text.UTF8Encoding $false))
Write-Output 'Created ignored .env.hackathon. Open it locally to configure sandbox credentials and read the manager login. AI calls are disabled.'
