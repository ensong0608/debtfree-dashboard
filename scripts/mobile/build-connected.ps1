# Explicit build entry; running this command requires the owner's check approval.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$taskRepo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
Set-Location -LiteralPath $taskRepo
if ($env:DEBTFREE_MOBILE_TEST_PUBLISHABLE_KEY -notmatch '^sb_publishable_[A-Za-z0-9_-]{16,512}$') { throw 'Provide only the isolated test publishable key in the process environment.' }
$taskOldMode = $env:DEBTFREE_CONNECTED_TEST
try {
    $env:DEBTFREE_CONNECTED_TEST = '1'
    & npm.cmd run build:mobile:connected
    if ($LASTEXITCODE) { throw 'Connected web build failed.' }
    & npx.cmd --no-install cap sync android
    if ($LASTEXITCODE) { throw 'Connected native sync failed.' }
    Push-Location -LiteralPath (Join-Path $taskRepo 'mobile\android')
    try {
        # Use the existing verified JDK/SDK environment from ANDROID_SETUP.md.
        # No install, device operation, signing change or deployment is performed.
        & .\gradlew.bat -PconnectedTest=true assembleDebug lintDebug
        if ($LASTEXITCODE) { throw 'Connected Android build or lint failed.' }
        & node (Join-Path $taskRepo 'scripts/mobile/audit-apk.mjs') --connected-test
        if ($LASTEXITCODE) { throw 'Connected APK asset audit failed.' }
    } finally { Pop-Location }
} finally { $env:DEBTFREE_CONNECTED_TEST = $taskOldMode }
