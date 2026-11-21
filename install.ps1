#Requires -Version 5.1
<#
.SYNOPSIS
  dsh-ai4s-stack one-click installer (Windows / PowerShell).

.DESCRIPTION
  Installs two DSH plugins into a profile:
    * dsh-skill-mcp-panel  - skills + MCP management panel (ships the dsh-panel CLI)
    * dsh-ai4s-composer    - full-auto AI4S mode (quick / solo / delegate / cluster)

  Installation goes through the official `dsh plugin --profile <name> add <spec>`
  command: profile dependencies and dsh.profile.bundles are maintained by DSH's
  own plugin-manager. The `desktop` profile is Electron-exclusive and rejects the
  CLI, so it is handled by a text-level patch of its manifest instead.

  NOTE: this file is deliberately ASCII-only. A UTF-8 BOM breaks
  [scriptblock]::Create((irm ...)), and a BOM-less UTF-8 file with non-ASCII text
  breaks `powershell -File` parsing on Windows PowerShell 5.1.

.EXAMPLE
  & ([scriptblock]::Create((irm https://raw.githubusercontent.com/SESZFY/dsh-ai4s-stack/main/install.ps1)))

.EXAMPLE
  & ([scriptblock]::Create((irm https://raw.githubusercontent.com/SESZFY/dsh-ai4s-stack/main/install.ps1))) `
      -Profile web -Mode cluster -ClusterModel "openrouter/deepseek-v3.2"

.EXAMPLE
  .\install.ps1 -Source . -Profile web

.EXAMPLE
  .\install.ps1 -Check

.EXAMPLE
  .\install.ps1 -Profile desktop -Manual -Apply

.EXAMPLE
  .\install.ps1 -Uninstall -Profile web
#>
[CmdletBinding()]
param(
  [string]$Profile,
  [string]$Mode,
  [string]$DelegateModel,
  [string]$ClusterModel,
  [string]$Ref = 'main',
  [string]$Source,
  [string]$RepoUrl = 'https://github.com/SESZFY/dsh-ai4s-stack',
  [string]$StageDir,
  [string]$DshBin,
  [string[]]$With = @('mcp-panel', 'ai4s', 'research'),
  [switch]$Uninstall,
  [switch]$NoFetch,
  [switch]$Check,
  [switch]$Manual,
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'

$script:PackageMap = [ordered]@{
  'mcp-panel' = @{ Dir = 'packages/dsh-skill-mcp-panel'; Name = 'dsh-skill-mcp-panel'; Label = 'skills + MCP panel' }
  'ai4s'      = @{ Dir = 'packages/dsh-ai4s-composer';  Name = 'dsh-ai4s-composer';  Label = 'full-auto AI4S mode' }
  'research'  = @{ Dir = 'packages/dsh-research-runner'; Name = 'dsh-research-runner'; Label = 'figure reproduction (/research)' }
}

# ---------------------------------------------------------------- output
function Say-Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Say-Ok($m)   { Write-Host "  [OK]   $m" -ForegroundColor Green }
function Say-Info($m) { Write-Host "  [..]   $m" -ForegroundColor Gray }
function Say-Warn($m) { Write-Host "  [!!]   $m" -ForegroundColor Yellow }
function Fail($m) {
  Write-Host "`n[FAIL] $m" -ForegroundColor Red
  exit 1
}

# ---------------------------------------------------------------- detect
function Get-DshHome {
  if ($env:DSH_HOME) { return $env:DSH_HOME }
  return (Join-Path $HOME '.dsh')
}

function Resolve-DshCli {
  if ($DshBin) {
    if (-not (Test-Path -LiteralPath $DshBin)) { Fail "-DshBin does not exist: $DshBin" }
    return (Resolve-Path -LiteralPath $DshBin).Path
  }
  $cmd = Get-Command dsh -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $binRel = 'node_modules\@deepseek-ai\dsh\lib\bin.js'

  $roots = @()
  if ($env:DSH_APP_DIR) { $roots += $env:DSH_APP_DIR }
  $roots += (Join-Path $env:LOCALAPPDATA 'Programs\dsh\resources\app\dsh')
  $roots += (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\app\dsh')
  foreach ($root in $roots) {
    if (-not $root) { continue }
    $candidate = Join-Path $root $binRel
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }

  # Electron install directories are often renamed (and may contain non-ASCII
  # characters), so enumerate candidates instead of hardcoding names.
  $bases = @()
  foreach ($drive in @('C', 'D', 'E', 'F')) { if (Test-Path -LiteralPath "${drive}:\") { $bases += "${drive}:\" } }
  foreach ($pf in @('Program Files', 'Program Files (x86)')) {
    $p = Join-Path $env:SystemDrive $pf
    if (Test-Path -LiteralPath $p) { $bases += $p }
  }
  if ($env:LOCALAPPDATA) { $bases += (Join-Path $env:LOCALAPPDATA 'Programs') }

  foreach ($base in $bases) {
    $dirs = @(Get-ChildItem -LiteralPath $base -Directory -ErrorAction SilentlyContinue |
              Where-Object { $_.Name -like 'DSH*' -or $_.Name -like '*DeepSeek*' -or $_.Name -like '*Harness*' })
    foreach ($d in $dirs) {
      foreach ($sub in @('resources\app\dsh', 'app\dsh', 'resources\app', '')) {
        $candidate = if ($sub) { Join-Path $d.FullName (Join-Path $sub $binRel) } else { Join-Path $d.FullName $binRel }
        if (Test-Path -LiteralPath $candidate) { return $candidate }
      }
    }
  }
  return $null
}

function Invoke-Dsh {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$CliArgs)
  if ($script:DshCliPath -like '*.js') {
    & node $script:DshCliPath @CliArgs
  } else {
    & $script:DshCliPath @CliArgs
  }
}

function Get-Profiles {
  $dir = Join-Path (Get-DshHome) 'profiles'
  if (-not (Test-Path -LiteralPath $dir)) { return @() }
  return @(Get-ChildItem -LiteralPath $dir -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name)
}

function Resolve-Profile {
  param([string]$Requested, [string[]]$Available)
  if ($Requested) {
    if ($Requested -eq 'desktop') {
      Say-Info 'desktop profile is Electron-exclusive; switching to manifest-patch mode.'
      return 'desktop'
    }
    if ($Available -notcontains $Requested) {
      Say-Warn "profile ""$Requested"" does not exist yet; DSH will create it from a template."
    }
    return $Requested
  }
  $candidates = @($Available | Where-Object { $_ -ne 'desktop' })
  if ($candidates.Count -eq 1) { return $candidates[0] }
  if ($candidates -contains 'web') {
    Say-Info 'no -Profile given, using web.'
    return 'web'
  }
  if ($candidates.Count -eq 0) {
    Say-Info 'no profile found, using web.'
    return 'web'
  }
  Fail ("multiple profiles found, pick one with -Profile: " + ($candidates -join ', '))
}

function Ensure-Pnpm {
  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($pnpm) { return $pnpm.Source }
  $guess = Join-Path $env:APPDATA 'npm\pnpm.cmd'
  if (Test-Path -LiteralPath $guess) { return $guess }

  Say-Warn 'pnpm not found; `dsh plugin` needs it. Installing pnpm ...'
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if (-not $npm) { Fail 'npm not found. Install Node.js 20+ first (https://nodejs.org).' }
  & npm install -g pnpm --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Fail 'npm install -g pnpm failed. Install pnpm manually and retry.' }

  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($pnpm) { return $pnpm.Source }
  if (Test-Path -LiteralPath $guess) { return $guess }
  Fail 'pnpm is still not resolvable after install.'
}

# ---------------------------------------------------------------- source
function Resolve-StackRoot {
  if ($Source) {
    if (-not (Test-Path -LiteralPath $Source)) { Fail "-Source does not exist: $Source" }
    $resolved = (Resolve-Path -LiteralPath $Source).Path
    if (Test-Path -LiteralPath (Join-Path $resolved 'packages\dsh-ai4s-composer\package.json')) { return $resolved }
    if (Test-Path -LiteralPath (Join-Path $resolved 'dsh-ai4s-stack\packages\dsh-ai4s-composer\package.json')) {
      return (Join-Path $resolved 'dsh-ai4s-stack')
    }
    Fail "-Source has no packages\dsh-ai4s-composer: $resolved"
  }
  if ($NoFetch) {
    if (-not $StageDir) { Fail '-NoFetch needs -StageDir pointing at downloaded sources.' }
    return (Resolve-Path -LiteralPath $StageDir).Path
  }

  $target = if ($StageDir) { $StageDir } else { Join-Path $env:LOCALAPPDATA "dsh-ai4s-stack\$Ref" }
  $marker = Join-Path $target 'packages\dsh-ai4s-composer\package.json'
  if (Test-Path -LiteralPath $marker) {
    Say-Ok "reusing downloaded sources: $target"
    return $target
  }

  $tmp = Join-Path ([IO.Path]::GetTempPath()) ("dsh-ai4s-stack-" + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  $zip = Join-Path $tmp 'src.zip'
  $urls = @(
    "$RepoUrl/archive/refs/heads/$Ref.zip",
    "$RepoUrl/archive/refs/tags/$Ref.zip"
  )
  $ok = $false
  foreach ($url in $urls) {
    try {
      Say-Info "downloading $url"
      Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing -TimeoutSec 120
      $ok = $true
      break
    } catch {
      Say-Warn ("download failed: " + $_.Exception.Message)
    }
  }
  if (-not $ok) {
    Fail @"
Source download failed. Options:
  1) configure a proxy and retry. git needs its own proxy setting:
     git config --global http.https://github.com.proxy http://127.0.0.1:7897
  2) clone manually and install from a local path:
     git clone $RepoUrl
     .\install.ps1 -Source .\dsh-ai4s-stack
"@
  }

  try { Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $tmp 'x') -Force }
  catch { Fail ("unzip failed: " + $_.Exception.Message) }
  $inner = Get-ChildItem -LiteralPath (Join-Path $tmp 'x') -Directory | Select-Object -First 1
  if (-not $inner) { Fail 'downloaded archive has no top-level directory.' }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
  Move-Item -LiteralPath $inner.FullName -Destination $target
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Say-Ok "sources staged at $target"
  return $target
}

# ---------------------------------------------------------------- desktop manifest patch
# `dsh plugin --profile desktop` is rejected by the CLI (Electron-exclusive), so the
# manifest is patched at text level: one line into dependencies and one into
# dsh.profile.bundles, everything else preserved byte for byte.
# Backup is written before the change and the result is JSON-validated; on any
# parse failure nothing is written at all.

function Find-BlockEnd {
  param([string]$Text, [int]$OpenIndex, [char]$Open, [char]$Close)
  $depth = 0
  $inString = $false
  for ($i = $OpenIndex; $i -lt $Text.Length; $i++) {
    $c = $Text[$i]
    if ($inString) {
      if ($c -eq '\') { $i++; continue }
      if ($c -eq '"') { $inString = $false }
      continue
    }
    if ($c -eq '"') { $inString = $true; continue }
    if ($c -eq $Open) { $depth++ }
    elseif ($c -eq $Close) { $depth--; if ($depth -eq 0) { return $i } }
  }
  return -1
}

function Insert-JsonItem {
  param([string]$Text, [int]$Open, [int]$Close, [string]$Item, [int]$Indent)
  $pad = ' ' * $Indent
  $i = $Close - 1
  while ($i -gt $Open -and [char]::IsWhiteSpace($Text[$i])) { $i-- }
  if ($i -eq $Open) {
    return $Text.Substring(0, $Open + 1) + "`n$pad$Item`n" + $Text.Substring($Close)
  }
  return $Text.Substring(0, $i + 1) + ",`n$pad$Item" + $Text.Substring($i + 1)
}

function Add-DesktopEntry {
  param([string]$ManifestPath, [string]$PackageName, [string]$LinkPath)

  $text = [IO.File]::ReadAllText($ManifestPath, [Text.Encoding]::UTF8)
  $original = $text

  if ($text -match [regex]::Escape('"' + $PackageName + '"')) {
    Say-Info "$PackageName already in profile manifest, skipped"
    return $false
  }

  # 1) dependencies
  $depMatch = [regex]::Match($text, '"dependencies"\s*:\s*\{')
  if (-not $depMatch.Success) { Fail "manifest has no dependencies block: $ManifestPath" }
  $open = $text.IndexOf('{', $depMatch.Index)
  $close = Find-BlockEnd -Text $text -OpenIndex $open -Open '{' -Close '}'
  if ($close -lt 0) { Fail 'unbalanced braces in dependencies' }
  $text = Insert-JsonItem -Text $text -Open $open -Close $close -Item "`"$PackageName`": `"link:$LinkPath`"" -Indent 4

  # 2) dsh.profile.bundles
  $bMatch = [regex]::Match($text, '"bundles"\s*:\s*\[')
  if (-not $bMatch.Success) {
    $profileMatch = [regex]::Match($text, '"profile"\s*:\s*\{')
    if (-not $profileMatch.Success) { Fail 'manifest has no dsh.profile block' }
    $pOpen = $text.IndexOf('{', $profileMatch.Index)
    $pClose = Find-BlockEnd -Text $text -OpenIndex $pOpen -Open '{' -Close '}'
    if ($pClose -lt 0) { Fail 'unbalanced braces in dsh.profile' }
    $block = ",`n      `"bundles`": [`n        `"$PackageName`"`n      ]"
    $text = $text.Substring(0, $pClose) + $block + $text.Substring($pClose)
  } else {
    $bOpen = $text.IndexOf('[', $bMatch.Index)
    $bClose = Find-BlockEnd -Text $text -OpenIndex $bOpen -Open '[' -Close ']'
    if ($bClose -lt 0) { Fail 'unbalanced brackets in bundles' }
    $text = Insert-JsonItem -Text $text -Open $bOpen -Close $bClose -Item "`"$PackageName`"" -Indent 8
  }

  # 3) validate
  try { $null = $text | ConvertFrom-Json } catch {
    Fail ("generated manifest is not valid JSON, nothing written (original untouched): " + $_.Exception.Message)
  }

  if ($text -eq $original) { return $false }

  if (-not $Apply) {
    Say-Info "would add $PackageName (pass -Apply to write)"
    return $false
  }

  $backup = "$ManifestPath.bak-ai4s-stack"
  [IO.File]::WriteAllText($backup, $original, (New-Object Text.UTF8Encoding($false)))
  [IO.File]::WriteAllText($ManifestPath, $text, (New-Object Text.UTF8Encoding($false)))
  Say-Ok "added $PackageName (backup: $(Split-Path -Leaf $backup))"
  return $true
}

# ---------------------------------------------------------------- main
$dshHome = Get-DshHome
$profiles = Get-Profiles

Write-Host ''
Write-Host '  dsh-ai4s-stack  installer' -ForegroundColor White
Write-Host '  ---------------------------------------------' -ForegroundColor DarkGray
Say-Info "DSH_HOME  : $dshHome"
Say-Info "profiles  : $(if ($profiles.Count) { $profiles -join ', ' } else { '(none)' })"

$script:DshCliPath = Resolve-DshCli
if ($script:DshCliPath) { Say-Info "dsh CLI   : $script:DshCliPath" } else { Say-Warn 'dsh CLI   : not found' }

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) { Say-Info "node      : $($nodeCmd.Source) ($(& node -v))" } else { Say-Warn 'node      : not found' }

$pnpmPath = Get-Command pnpm -ErrorAction SilentlyContinue
if ($pnpmPath) { Say-Info "pnpm      : $($pnpmPath.Source)" } else { Say-Warn 'pnpm      : not found (will be installed)' }

if ($Check) {
  Say-Step 'check only (-Check)'
  if ($script:DshCliPath) { Say-Ok 'ready to install' } else { Say-Warn 'dsh CLI not found; pass -DshBin' }
  exit 0
}

if (-not $nodeCmd) { Fail 'node not found. Install Node.js 20+ first (https://nodejs.org).' }

$resolvedProfile = Resolve-Profile -Requested $Profile -Available $profiles
Say-Info "target profile : $resolvedProfile"

$selected = @($With | ForEach-Object { $_.Split(',') } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$unknown = @($selected | Where-Object { -not $script:PackageMap.Contains($_) })
if ($unknown.Count) { Fail ("-With accepts " + ($script:PackageMap.Keys -join ' / ') + ", got: " + ($unknown -join ', ')) }
if (-not $selected.Count) { Fail '-With is empty, nothing to install.' }

# ---- uninstall
if ($Uninstall) {
  $names = @($selected | ForEach-Object { $script:PackageMap[$_].Name })
  if ($Manual -or $resolvedProfile -eq 'desktop') {
    Say-Step "uninstall from profile ""$resolvedProfile"" (manual)"
    $mf = Join-Path (Join-Path $dshHome "profiles\$resolvedProfile") 'package.json'
    Say-Info "edit $mf and remove these lines:"
    foreach ($n in $names) { Say-Info "  $n" }
    exit 0
  }
  if (-not $script:DshCliPath) { Fail 'uninstall needs the dsh CLI; pass -DshBin.' }
  Say-Step "uninstall from profile ""$resolvedProfile"""
  Invoke-Dsh plugin --profile $resolvedProfile remove @names
  if ($LASTEXITCODE -ne 0) { Fail 'uninstall failed, see output above.' }
  Say-Ok "removed: $($names -join ', ')"
  Write-Host "`nRestart DSH to apply." -ForegroundColor Yellow
  exit 0
}

$useManual = $Manual -or ($resolvedProfile -eq 'desktop')

if (-not $useManual -and -not $script:DshCliPath) {
  Fail @"
dsh CLI not found. Pick one:
  1) pass the path:  -DshBin "D:\DSH\resources\app\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js"
  2) set DSH_APP_DIR to the resources\app\dsh directory
  3) install from the desktop app GUI (Settings -> Plugins)
"@
}

$null = Ensure-Pnpm
Say-Ok 'pnpm ready'

$root = Resolve-StackRoot
$installed = @()

if ($useManual) {
  Say-Step "manifest patch mode: profile ""$resolvedProfile"""
  if (-not $Apply) { Say-Warn 'no -Apply given, preview only (nothing written).' }
  $manifestPath = Join-Path (Join-Path $dshHome "profiles\$resolvedProfile") 'package.json'
  if (-not (Test-Path -LiteralPath $manifestPath)) {
    Fail "profile directory missing: $manifestPath`nLaunch the desktop app once with this profile, or use -Profile web."
  }
  foreach ($key in $selected) {
    $meta = $script:PackageMap[$key]
    $dir = Join-Path $root ($meta.Dir -replace '/', '\')
    if (-not (Test-Path -LiteralPath (Join-Path $dir 'package.json'))) { Fail "missing package sources: $dir" }
    $link = ($dir -replace '\\', '/')
    Say-Info "$($meta.Label)  ->  link:$link"
    $null = Add-DesktopEntry -ManifestPath $manifestPath -PackageName $meta.Name -LinkPath $link
    $installed += $meta.Name
  }
  if ($Apply) {
    Say-Ok "profile manifest updated: $manifestPath"
    Write-Host ''
    Write-Host '  Restart the DSH desktop app so pnpm materializes the links,' -ForegroundColor Yellow
    Write-Host "  or run:  cd `"$(Split-Path -Parent $manifestPath)`" ; pnpm install" -ForegroundColor Yellow
  } else {
    Say-Warn 'preview finished. Re-run with -Apply to write.'
  }
} else {
  Say-Step "install into profile ""$resolvedProfile"""
  foreach ($key in $selected) {
    $meta = $script:PackageMap[$key]
    $dir = Join-Path $root ($meta.Dir -replace '/', '\')
    if (-not (Test-Path -LiteralPath (Join-Path $dir 'package.json'))) { Fail "missing package sources: $dir" }
    Say-Info "installing $($meta.Label)  ($($meta.Name))"
    Invoke-Dsh plugin --profile $resolvedProfile add $dir
    if ($LASTEXITCODE -ne 0) { Fail "installing $($meta.Name) failed, see output above." }
    $installed += $meta.Name
  }
  Say-Ok "installed: $($installed -join ', ')"
}

# ---- verify
Say-Step 'verify profile mounts'
$manifestPath = Join-Path (Join-Path $dshHome "profiles\$resolvedProfile") 'package.json'
if (Test-Path -LiteralPath $manifestPath) {
  $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $bundles = @($manifest.dsh.profile.bundles)
  foreach ($name in $installed) {
    if ($bundles -contains $name) { Say-Ok "bundles contains $name" }
    else { Say-Warn "bundles misses $name - check $manifestPath" }
  }
}

# ---- mode preference
$setMode = $root + '\packages\dsh-ai4s-composer\scripts\set-mode.mjs'
if (($Mode -or $DelegateModel -or $ClusterModel) -and (Test-Path -LiteralPath $setMode)) {
  Say-Step 'write AI4S mode preference'
  $modeArgs = @($setMode)
  if ($Mode) { $modeArgs += @('--mode', $Mode) }
  if ($DelegateModel) { $modeArgs += @('--delegate', $DelegateModel) }
  if ($ClusterModel) { $modeArgs += @('--cluster', $ClusterModel) }
  & node @modeArgs
  if ($LASTEXITCODE -ne 0) { Say-Warn 'mode write failed; run set-mode.mjs manually later.' }
}

Write-Host ''
Write-Host '  ---------------------------------------------' -ForegroundColor DarkGray
Write-Host '  done.' -ForegroundColor Green
Write-Host ''
Write-Host '  next:'
Write-Host "    1) restart DSH:  dsh $resolvedProfile"
Write-Host '    2) the sidebar shows the Skills / MCP panel'
Write-Host '    3) switch AI4S mode:'
Write-Host "         node `"$setMode`" --show"
Write-Host "         node `"$setMode`" --mode cluster --cluster <provider/model>"
Write-Host ''
Write-Host '  uninstall:'
Write-Host "     .\install.ps1 -Uninstall -Profile $resolvedProfile"
Write-Host ''
Write-Host "  sources (keep them: the profile references them via link:): $root" -ForegroundColor DarkGray
Write-Host ''
