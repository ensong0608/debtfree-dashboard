# Run interactively only after approval for isolated backend setup.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$taskRepo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
Set-Location -LiteralPath $taskRepo
$taskSecureToken = Read-Host 'Supabase management token scoped to the mobile test project (input hidden)' -AsSecureString
$taskTokenPointer = [IntPtr]::Zero
try {
    $taskTokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecureToken)
    $taskPlainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskTokenPointer)
    $taskPlainToken | & node (Join-Path $PSScriptRoot 'provision-connected-secrets.mjs')
    if ($LASTEXITCODE) { throw 'Isolated secret setup did not complete. No credential value is included in this message.' }
} finally {
    $taskPlainToken = $null
    if ($taskTokenPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskTokenPointer) }
    $taskSecureToken.Dispose()
}
