$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (!(Test-Path node_modules)) { & npm.cmd ci; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
& npm.cmd run db:migrate:local
if ($LASTEXITCODE) { exit $LASTEXITCODE }
& npm.cmd run db:seed:local
if ($LASTEXITCODE) { exit $LASTEXITCODE }
Write-Host 'Open http://localhost:8787/__local to choose a test account. Ctrl+C stops the server.'
& npm.cmd run dev:local
