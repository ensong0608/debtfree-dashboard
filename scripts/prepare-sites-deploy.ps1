param(
  [string]$ProjectDir = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

$project = [IO.Path]::GetFullPath($ProjectDir)
$hosting = Join-Path $project ".openai\hosting.json"
$serverEntry = Join-Path $project "dist\server\index.js"

if (-not (Test-Path -LiteralPath $hosting)) {
  throw "Missing .openai/hosting.json."
}

Push-Location $project
try {
  & git diff --quiet
  if ($LASTEXITCODE -ne 0) {
    throw "Tracked working-tree changes remain. Commit them before preparing a deployment."
  }

  & git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    throw "Staged changes remain. Commit them before preparing a deployment."
  }

  $commitSha = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $commitSha) {
    throw "Could not resolve the current commit."
  }

  & npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "The production build failed."
  }

  & git diff --quiet
  if ($LASTEXITCODE -ne 0) {
    throw "The build changed tracked source files. Commit those changes and prepare again."
  }

  & git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    throw "The build changed staged source files. Commit those changes and prepare again."
  }

  if (-not (Test-Path -LiteralPath $serverEntry)) {
    throw "Missing dist/server/index.js after the build."
  }

  $tar = Get-Command tar.exe -ErrorAction Stop
  $tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  $packageRoot = Join-Path $tempBase ("debtfree-sites-" + [guid]::NewGuid().ToString("N"))
  $stage = Join-Path $packageRoot "stage"
  $archive = Join-Path $packageRoot "debtfree-dashboard.tar.gz"
  $resolvedPackageRoot = [IO.Path]::GetFullPath($packageRoot)

  if (-not $resolvedPackageRoot.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to use an unsafe temporary package path."
  }

  New-Item -ItemType Directory -Path (Join-Path $stage "dist\.openai") -Force | Out-Null

  try {
    Copy-Item -Path (Join-Path $project "dist\*") -Destination (Join-Path $stage "dist") -Recurse -Force
    Copy-Item -LiteralPath $hosting -Destination (Join-Path $stage "dist\.openai\hosting.json") -Force

    $drizzle = Join-Path $project "drizzle"
    if (Test-Path -LiteralPath $drizzle) {
      New-Item -ItemType Directory -Path (Join-Path $stage "dist\.openai\drizzle") -Force | Out-Null
      Copy-Item -Path (Join-Path $drizzle "*") -Destination (Join-Path $stage "dist\.openai\drizzle") -Recurse -Force
    }

    & $tar.Source -C $stage -czf $archive dist
    if ($LASTEXITCODE -ne 0) {
      throw "Could not create the Sites archive."
    }

    $entries = & $tar.Source -tzf $archive
    if ($LASTEXITCODE -ne 0) {
      throw "Could not inspect the Sites archive."
    }

    if ($entries -notcontains "dist/server/index.js") {
      throw "The Sites archive is missing dist/server/index.js."
    }

    if ($entries -notcontains "dist/.openai/hosting.json") {
      throw "The Sites archive is missing dist/.openai/hosting.json."
    }
  }
  finally {
    $resolvedStage = [IO.Path]::GetFullPath($stage)
    if ($resolvedStage.StartsWith($resolvedPackageRoot, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedStage)) {
      Remove-Item -LiteralPath $resolvedStage -Recurse -Force
    }
  }

  $hostingConfig = Get-Content -Raw -LiteralPath $hosting | ConvertFrom-Json
  [ordered]@{
    project_id = $hostingConfig.project_id
    commit_sha = $commitSha
    archive = $archive
  } | ConvertTo-Json -Compress
}
finally {
  Pop-Location
}
