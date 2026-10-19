# Local-only portable tools. Status is read-only. Never accepts SDK licenses.
[CmdletBinding()]
param(
    [ValidateSet('Status','Prepare','ReviewLicenses','InstallSdk')][string]$Mode='Status',
    [string]$JavaHome,
    [string]$SdkRoot,
    [string[]]$Packages=@(),
    [switch]$LicensesAccepted
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$root=Join-Path $repo '.wrangler\android-tools'
$jdkUrl='https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1.zip'
$jdkHash='f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e'
$googleUrl='https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip'
$googleHash='90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a'
function Assert-PrivatePath([string]$Path) {
    $full=[IO.Path]::GetFullPath($Path)
    if(-not $full.StartsWith($root + '\',[StringComparison]::OrdinalIgnoreCase)){throw 'Write target outside private tools root.'}
    # Reject junctions/symlinks in existing ancestors rather than following them.
    $cursor=$full
    while($cursor -and $cursor.Length -ge $repo.Length){
        if(Test-Path -LiteralPath $cursor){if((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse point in tool path.'}}
        $cursor=Split-Path $cursor
    }
}
function Fetch-Verified([string]$Url,[string]$Hash,[string]$File){
    Assert-PrivatePath $File
    $part=$File+'.part'
    $lockFile=$File+'.download.lock'
    Assert-PrivatePath $part;Assert-PrivatePath $lockFile
    # Lock only this archive's download workflow; interruption releases the OS lock.
    $lock=[IO.File]::Open($lockFile,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    try{
        if(Test-Path -LiteralPath $File){
            if((Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Hash){throw 'Cached archive checksum mismatch; retained for inspection.'}
            return
        }
        if(-not(Test-Path -LiteralPath $part)){
            if((Get-PSDrive C).Free -lt 3GB){throw 'Need at least 3 GiB free for preparation; no files removed.'}
            Write-Output ('Downloading pinned archive to temporary file: '+[IO.Path]::GetFileName($part))
            Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $part -TimeoutSec 600
        }
        if((Get-FileHash -LiteralPath $part -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Hash){throw 'Temporary archive checksum mismatch; retained for inspection, not promoted.'}
        # Same-directory promotion only after verification; never overwrite a canonical file.
        Assert-PrivatePath $part;Assert-PrivatePath $File
        Move-Item -LiteralPath $part -Destination $File
    }finally{$lock.Dispose()}
}
function Expand-Verified([string]$Archive,[string]$Destination,[string]$Marker){
    Assert-PrivatePath $Destination
    if(Test-Path -LiteralPath $Destination){
        if(-not(Test-Path -LiteralPath (Join-Path $Destination '.verified-sha256'))){throw 'Incomplete/unmarked extraction exists; inspect manually. No overwrite performed.'}
        if((Get-Content -LiteralPath (Join-Path $Destination '.verified-sha256') -Raw).Trim() -ne $Marker){throw 'Extraction marker mismatch.'}
        return
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip=[IO.Compression.ZipFile]::OpenRead($Archive)
    try{
        foreach($entry in $zip.Entries){
            $target=[IO.Path]::GetFullPath((Join-Path $Destination $entry.FullName))
            if(-not $target.StartsWith($Destination+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe archive entry.'}
        }
    }finally{$zip.Dispose()}
    [IO.Compression.ZipFile]::ExtractToDirectory($Archive,$Destination)
    Set-Content -LiteralPath (Join-Path $Destination '.verified-sha256') -Value $Marker
}
function Run-Local([string]$Executable,[string]$Arguments,[int]$Seconds=20){
    $info=New-Object Diagnostics.ProcessStartInfo
    $info.FileName=$Executable;$info.Arguments=$Arguments;$info.UseShellExecute=$false;$info.CreateNoWindow=$true
    $info.RedirectStandardInput=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
    $process=New-Object Diagnostics.Process;$process.StartInfo=$info
    try{
        if(-not $process.Start()){throw 'Local tool start failed.'}
        $process.StandardInput.Close() # EOF; never supplies consent or yes.
        $out=$process.StandardOutput.ReadToEndAsync();$err=$process.StandardError.ReadToEndAsync()
        if(-not $process.WaitForExit($Seconds*1000)){$process.Kill();throw 'Local tool timeout.'}
        if(-not $out.Wait(1000) -or -not $err.Wait(1000)){throw 'Tool output timeout.'}
        if($process.ExitCode -ne 0){throw 'Local tool returned failure; raw output suppressed.'}
        return ($out.Result+"`n"+$err.Result)
    }finally{$process.Dispose()}
}
try{
    foreach($explicit in @($JavaHome,$SdkRoot)){if($explicit -and -not(Test-Path -LiteralPath $explicit -PathType Container)){throw 'Explicit tool directory does not exist.'}}
    $jdkDefault=Join-Path $root 'temurin-21.0.12.1\jdk-21.0.12.1+1'
    if(-not $JavaHome){
        foreach($candidate in @($env:JAVA_HOME,'C:\Program Files\Android\Android Studio\jbr',$jdkDefault)){
            if($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'bin\javac.exe'))){$JavaHome=$candidate;break}
        }
    }
    $sdkDefault=Join-Path $root 'sdk'
    if(-not $SdkRoot){
        foreach($candidate in @($env:ANDROID_HOME,$env:ANDROID_SDK_ROOT,(Join-Path $env:LOCALAPPDATA 'Android\Sdk'),'C:\Android\Sdk',$sdkDefault)){
            if($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'cmdline-tools') -PathType Container)){$SdkRoot=$candidate;break}
        }
    }
    if($Mode -eq 'Status'){
        [ordered]@{mode='Status';toolsRoot=$root;javaHome=$JavaHome;sdkRoot=$SdkRoot;freeGiB=[math]::Round((Get-PSDrive C).Free/1GB,1);licenseState='Not validated; owner interactive acceptance required before SDK install';nativeBuildVerified=$false} | ConvertTo-Json
        if(-not $JavaHome -or -not $SdkRoot){exit 1};exit 0
    }
    if($Mode -eq 'InstallSdk'){
        if(-not $LicensesAccepted){throw 'InstallSdk requires explicit LicensesAccepted after owner interaction.'}
        if(-not $Packages.Count){throw 'Specify exact manager-reviewed SDK packages.'}
        foreach($package in $Packages){if($package -notmatch '^(platform-tools|platforms;android-\d+|build-tools;\d+\.\d+\.\d+)$'){throw 'Package outside minimal Android scope.'}}
        if(-not $SdkRoot -or -not $JavaHome){throw 'Prepare tools first.'}
        Assert-PrivatePath $SdkRoot # Existing external SDKs are reused read-only only.
        if(-not(Test-Path -LiteralPath (Join-Path $SdkRoot 'licenses\android-sdk-license'))){throw 'Owner SDK license record absent; run interactive command in guide.'}
    }
    foreach($directory in @((Join-Path $root 'downloads'),(Join-Path $root 'android-user'))){Assert-PrivatePath $directory;New-Item -ItemType Directory -Path $directory -Force|Out-Null}
    if($Mode -eq 'Prepare'){
        # Revalidate retained canonical archives even when extracted tools are reused.
        foreach($cache in @(@('downloads\temurin-21.0.12.1.zip',$jdkUrl,$jdkHash),@('downloads\commandlinetools-win-15859902.zip',$googleUrl,$googleHash))){
            $cachedFile=Join-Path $root $cache[0]
            if(Test-Path -LiteralPath $cachedFile){Fetch-Verified $cache[1] $cache[2] $cachedFile}
        }
        if(-not $JavaHome){
            $archive=Join-Path $root 'downloads\temurin-21.0.12.1.zip'
            Fetch-Verified $jdkUrl $jdkHash $archive
            Expand-Verified $archive (Join-Path $root 'temurin-21.0.12.1') $jdkHash
            $JavaHome=$jdkDefault
        }
        if(-not $SdkRoot){$SdkRoot=$sdkDefault}
        Assert-PrivatePath $SdkRoot
        $archive=Join-Path $root 'downloads\commandlinetools-win-15859902.zip'
        if(-not(Test-Path -LiteralPath (Join-Path $SdkRoot 'cmdline-tools\15859902\bin\sdkmanager.bat'))){
            Fetch-Verified $googleUrl $googleHash $archive
            Expand-Verified $archive (Join-Path $SdkRoot 'cmdline-tools\15859902') $googleHash
        }
    }
    # Normalize Google's single archive folder to documented SDK layout, without replacement.
    $nested=Join-Path $SdkRoot 'cmdline-tools\15859902\cmdline-tools'
    if($Mode -eq 'Prepare' -and (Test-Path -LiteralPath $nested)){
        foreach($item in Get-ChildItem -LiteralPath $nested -Force){
            $target=Join-Path (Split-Path $nested) $item.Name
            Assert-PrivatePath $item.FullName;Assert-PrivatePath $target
            if(Test-Path -LiteralPath $target){throw 'Layout normalization target exists; no overwrite.'}
            Move-Item -LiteralPath $item.FullName -Destination $target
        }
    }
    $env:JAVA_HOME=$JavaHome;$env:ANDROID_HOME=$SdkRoot;$env:ANDROID_USER_HOME=Join-Path $root 'android-user'
    $java=Join-Path $JavaHome 'bin\java.exe';$javac=Join-Path $JavaHome 'bin\javac.exe'
    if(-not(Test-Path -LiteralPath $java) -or -not(Test-Path -LiteralPath $javac)){throw 'Selected JDK incomplete.'}
    $javaOutput=Run-Local $java '-version';$javacOutput=Run-Local $javac '-version'
    $compiler=[regex]::Match($javacOutput,'(?m)^javac (21(?:\.\d+){0,3})\s*$')
    if(-not $compiler.Success){throw 'Selected compiler is not verified JDK21.'}
    $manager=Join-Path $SdkRoot 'cmdline-tools\15859902\bin\sdkmanager.bat'
    if(-not(Test-Path -LiteralPath $manager)){throw 'Pinned SDK manager missing; existing SDK is not modified.'}
    $version=Run-Local $env:ComSpec ('/d /s /c ""'+$manager+'" --version"')
    $token=[regex]::Match($version,'(?m)^\d+(?:\.\d+)*\s*$')
    if(-not $token.Success){throw 'SDK manager version not recognized.'}
    Write-Output ('Verified compiler '+$compiler.Groups[1].Value+'; sdkmanager '+$token.Value.Trim())
    if($Mode -eq 'ReviewLicenses'){
        Assert-PrivatePath $SdkRoot
        Write-Output 'Owner interactive review: choose whether to accept each official license. No package installation requested.'
        & $manager "--sdk_root=$SdkRoot" --licenses
        if($LASTEXITCODE -ne 0){throw 'Interactive license review did not complete successfully.'}
        exit 0
    }
    if($Mode -eq 'InstallSdk'){
        # Verify all current licenses accepted using EOF, before any package install.
        $licenseOutput=Run-Local $env:ComSpec ('/d /s /c ""'+$manager+'" --sdk_root="'+$SdkRoot+'" --licenses"') 120
        if($licenseOutput -notmatch 'All SDK package licenses accepted'){throw 'Unresolved SDK licenses; no packages requested.'}
        $arguments='/d /s /c ""'+$manager+'" --sdk_root="'+$SdkRoot+'" --install '+(($Packages|ForEach-Object{'"'+$_+'"'}) -join ' ')+'"'
        $null=Run-Local $env:ComSpec $arguments 1200
        Write-Output 'Requested minimal SDK install completed; verify package metadata before native build.'
    }
    Write-Output ('JAVA_HOME='+$JavaHome)
    Write-Output ('ANDROID_HOME='+$SdkRoot)
    Write-Output 'No license accepted by this script. Native build/device checks remain pending.'
    exit 0
}catch{Write-Output 'Android setup stopped: check explicit paths, private-root safety, hashes, tools or license prerequisites. Raw output suppressed.';exit 2}
