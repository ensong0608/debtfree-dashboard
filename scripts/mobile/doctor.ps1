# Read-only discovery. No SDK/adb/Gradle commands or network operations.
[CmdletBinding()]
param([string]$JavaPath, [string]$SdkPath, [string]$StudioPath, [switch]$Json)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function Resolve-Tool([string[]]$Candidates, [string]$Command) {
    foreach ($candidate in $Candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return (Get-Item -LiteralPath $candidate).FullName }
    }
    if ($Command) {
        $found = Get-Command $Command -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { return $found.Source }
    }
    return $null
}
function ConvertFrom-ToolVersion([string]$Output, [ValidateSet('node','java','javac')][string]$Tool) {
    # Require a genuine version line for the requested tool; ignore option banners.
    $number = '(?<version>\d+(?:\.\d+){0,3}(?:_\d+)?)'
    $pattern = switch ($Tool) {
        'node' { '^v' + $number + '\s*$' }
        'java' { '^(?:java|openjdk)\s+(?:version\s+)?"' + $number + '(?:[-+][^"\r\n]*)?"(?:\s+[^\r\n]*)?\s*$' }
        'javac' { '^javac\s+' + $number + '(?:[-+][^\s\r\n]+)?\s*$' }
    }
    foreach ($line in ($Output -split '\r?\n')) {
        $match = [regex]::Match($line.Trim(), $pattern)
        if ($match.Success) { return $match.Groups['version'].Value }
    }
    throw 'Recognized tool version line unavailable.'
}
function Read-Version([string]$Executable, [string]$Arguments) {
    if (-not $Executable) { return $null }
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $Executable
    $start.Arguments = $Arguments
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $start
    try {
        if (-not $process.Start()) { throw 'Version process did not start.' }
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(5000)) {
            $process.Kill()
            throw 'Version check exceeded five seconds.'
        }
        if (-not $stdout.Wait(1000) -or -not $stderr.Wait(1000)) { throw 'Version output timed out.' }
        if ($process.ExitCode -ne 0) { throw 'Version check returned failure.' }
        # Keep streams on separate lines; emit only recognized version tokens.
        $tool = [System.IO.Path]::GetFileNameWithoutExtension($Executable).ToLowerInvariant()
        return ConvertFrom-ToolVersion ($stdout.Result + "`n" + $stderr.Result) $tool
    } finally { $process.Dispose() }
}
function Read-Property([string]$File, [string]$Key) {
    if (Test-Path -LiteralPath $File -PathType Leaf) {
        foreach ($line in [System.IO.File]::ReadAllLines($File)) {
            if ($line -match ('^' + [regex]::Escape($Key) + '\s*=\s*([0-9.]+)\s*$')) { return $Matches[1] }
        }
    }
    return $null
}
try {
    $invalid = @()
    foreach ($entry in @(@('JavaPath',$JavaPath), @('SdkPath',$SdkPath), @('StudioPath',$StudioPath))) {
        if ($entry[1] -and -not (Test-Path -LiteralPath $entry[1] -PathType Container)) { $invalid += $entry[0] }
    }
    if ($invalid.Count) { throw ('Explicit directory does not exist: ' + ($invalid -join ', ')) }
    $studioCandidates = @($StudioPath, (Join-Path $env:ProgramFiles 'Android\Android Studio'))
    $studio = $studioCandidates | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'bin\studio64.exe') -PathType Leaf) } | Select-Object -First 1
    if (-not $studio) {
        $studioExe = Resolve-Tool @() 'studio64.exe'
        if ($studioExe) { $studio = Split-Path (Split-Path $studioExe) }
    }
    if (-not $studio) { $studio = $null }
    $javaCandidates = @()
    foreach ($root in @($JavaPath, $env:JAVA_HOME)) { if ($root) { $javaCandidates += Join-Path $root 'bin\java.exe' } }
    if ($studio) { $javaCandidates += Join-Path $studio 'jbr\bin\java.exe' }
    $java = Resolve-Tool $javaCandidates 'java.exe'
    $javac = $null
    if ($java) { $javac = Resolve-Tool @((Join-Path (Split-Path $java) 'javac.exe')) '' }
    $sdkCandidates = @($SdkPath, $env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA 'Android\Sdk'), 'C:\Android\Sdk')
    $sdk = $sdkCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Container) } | Select-Object -First 1
    if (-not $sdk) {
        $adbOnPath = Resolve-Tool @() 'adb.exe'
        if ($adbOnPath) { $sdk = Split-Path (Split-Path $adbOnPath) }
    }
    if (-not $sdk) { $sdk = $null }
    $platforms = @(); $buildTools = @(); $adb = $null; $commandLineTools = @()
    if ($sdk) {
        $adb = Resolve-Tool @((Join-Path $sdk 'platform-tools\adb.exe')) ''
        foreach ($part in @('platforms', 'build-tools', 'cmdline-tools')) {
            $folder = Join-Path $sdk $part
            if (Test-Path -LiteralPath $folder -PathType Container) {
                foreach ($dir in Get-ChildItem -LiteralPath $folder -Directory) {
                    $properties = Join-Path $dir.FullName 'source.properties'
                    if ($part -eq 'platforms') { $api = Read-Property $properties 'AndroidVersion.ApiLevel'; if ($api) { $platforms += [int]$api } }
                    if ($part -eq 'build-tools') { $revision = Read-Property $properties 'Pkg.Revision'; if ($revision -and (Test-Path -LiteralPath (Join-Path $dir.FullName 'aapt2.exe'))) { $buildTools += $revision } }
                    if ($part -eq 'cmdline-tools' -and (Test-Path -LiteralPath (Join-Path $dir.FullName 'bin\sdkmanager.bat'))) { $commandLineTools += $dir.Name }
                }
            }
        }
    }
    $node = Resolve-Tool @() 'node.exe'
    $nodeVersion = Read-Version $node '--version'
    $javaVersion = Read-Version $java '-version'
    $javacVersion = Read-Version $javac '-version'
    $gaps = @()
    if (-not $nodeVersion -or [int]($nodeVersion.Split('.')[0]) -lt 22) { $gaps += 'Node 22+ required.' }
    if (-not $javaVersion -or -not $javacVersion -or [int]($javacVersion.Split('.')[0]) -lt 21) { $gaps += 'Compatible JDK with Java 21 compilation required; verify pinned Gradle compatibility.' }
    if (-not $studio) { $gaps += 'Android Studio not discovered (custom installation may exist).' }
    if (-not $sdk) { $gaps += 'Android SDK not discovered (custom installation may exist).' }
    if ($platforms -notcontains 36) { $gaps += 'SDK Platform API 36 metadata not found.' }
    if (-not $adb) { $gaps += 'SDK Platform-Tools adb executable not found; not invoked.' }
    if (-not $buildTools.Count) { $gaps += 'SDK Build-Tools metadata/aapt2 not found.' }
    if (-not $commandLineTools.Count) { $gaps += 'SDK Command-line Tools not found.' }
    $result = [ordered]@{schemaVersion=1; status=$(if ($gaps.Count) {'unready'} else {'prerequisites-found'}); buildReady=$false; nodeVersion=$nodeVersion; javaVersion=$javaVersion; javacVersion=$javacVersion; javaExecutable=$java; studioDirectory=$studio; sdkDirectory=$sdk; sdkPlatforms=$platforms; buildTools=$buildTools; commandLineTools=$commandLineTools; adbPresent=[bool]$adb; freeGiB=[math]::Round((Get-PSDrive C).Free/1GB,1); gaps=$gaps; limitation='Discovery only: Studio version, licenses, pinned-template compatibility, native build and devices remain unverified. No whole-disk search.'}
    if ($Json) { $result | ConvertTo-Json -Depth 5 } else {
        Write-Output ('Android doctor: ' + $result.status)
        Write-Output ('Node: {0}; Java: {1}; javac: {2}; C: free: {3} GiB' -f $nodeVersion,$javaVersion,$javacVersion,$result.freeGiB)
        Write-Output ('Studio: {0}; SDK: {1}' -f $studio,$sdk)
        foreach ($gap in $gaps) { Write-Output ('- ' + $gap) }
        Write-Output $result.limitation
    }
    if ($gaps.Count) { exit 1 }; exit 0
} catch {
    # Do not echo raw exceptions: they can contain user paths or subprocess output.
    $message = 'Doctor failed. Check explicit directories, permissions and five-second local version checks.'
    if ($Json) { [ordered]@{schemaVersion=1;status='error';buildReady=$false;error=$message} | ConvertTo-Json } else { Write-Output $message }
    exit 2
}
