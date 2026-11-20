#Requires -Version 5.1
<#
.SYNOPSIS
  Publish this repository to GitHub in one command: create the repo if missing,
  push main, push tags.

.DESCRIPTION
  Token resolution order:
    1) -Token
    2) $env:GITHUB_TOKEN / $env:GH_TOKEN
    3) the github.com credential already stored in Git Credential Manager

  If none is found, authorize once interactively (GCM opens a browser and stores
  the token), then re-run:
      "protocol=https`nhost=github.com`n`n" | git credential fill

  With a token the repo is created through the API; without repo-admin rights the
  API step is skipped and an existing repo is pushed directly.

  NOTE: ASCII-only on purpose. A UTF-8 BOM breaks [scriptblock]::Create((irm ...)),
  and BOM-less UTF-8 with non-ASCII text breaks `powershell -File` on PS 5.1
  (non-ASCII inside comments is enough to corrupt the parse).

.EXAMPLE
  .\push.ps1

.EXAMPLE
  $env:GITHUB_TOKEN = "ghp_xxx"; .\push.ps1 -Private
#>
[CmdletBinding()]
param(
  [string]$Token,
  [string]$Owner = 'SESZFY',
  [string]$Repo = 'dsh-ai4s-stack',
  [string]$Description = 'DSH plugins: skills/MCP panel + full-auto AI4S composer, with one-click install',
  [switch]$Private,
  [switch]$SkipRepoCreate
)

$ErrorActionPreference = 'Stop'

function Say-Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Say-Ok($m)   { Write-Host "  [OK]   $m" -ForegroundColor Green }
function Say-Info($m) { Write-Host "  [..]   $m" -ForegroundColor Gray }
function Fail($m) { Write-Host "`n[FAIL] $m" -ForegroundColor Red; exit 1 }

# Drop the lines PowerShell adds when a native command writes to stderr.
function Test-GitLine {
  param([string]$Line)
  if (-not $Line -or -not $Line.Trim()) { return $false }
  if ($Line -match '^\s{2,}') { return $false }
  if ($Line -match '^At \S|^git(\.exe)? : |^powershell(\.exe)? : ') { return $false }
  if ($Line -match 'CategoryInfo|FullyQualifiedErrorId|NativeCommandError|^\s*\+') { return $false }
  return $true
}

function Invoke-GitStream {
  param([string[]]$GitArgs)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $text = & git @GitArgs 2>&1 | Out-String
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  ($text -split "`n") | Where-Object { Test-GitLine $_ } | ForEach-Object {
    Say-Info ($_ -replace [regex]::Escape($Token), '***')
  }
  return $code
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

# ---- token
if (-not $Token) {
  if ($env:GITHUB_TOKEN) { $Token = $env:GITHUB_TOKEN }
  elseif ($env:GH_TOKEN) { $Token = $env:GH_TOKEN }
  else {
    $prev = $ErrorActionPreference
    $prevGcm = $env:GCM_INTERACTIVE
    $ErrorActionPreference = 'Continue'
    $env:GCM_INTERACTIVE = 'never'
    try {
      $probe = ("protocol=https`nhost=github.com`n`n" | & git credential fill 2>&1) | Out-String
      foreach ($line in ($probe -split "`n")) {
        if ($line -match '^\s*password=(.+)$') { $Token = $Matches[1].Trim(); break }
      }
    } catch { }
    $env:GCM_INTERACTIVE = $prevGcm
    $ErrorActionPreference = $prev
    if ($Token) { Say-Info 'using the github.com credential stored in Git Credential Manager' }
  }
}

if (-not $Token) {
  Fail @"
No GitHub token. Three options:
  1) authorize once (GCM opens a browser, then stores the token):
       "protocol=https`nhost=github.com`n`n" | git credential fill
     then re-run:  .\push.ps1
  2) `$env:GITHUB_TOKEN = "ghp_xxx"; .\push.ps1
  3) .\push.ps1 -Token "ghp_xxx"
Token page: https://github.com/settings/tokens
  classic: check `repo`;  fine-grained: Contents=write + Administration=write
"@
}

if (-not (Test-Path -LiteralPath (Join-Path $root '.git'))) { Fail "not a git repository: $root" }

$headers = @{
  Authorization          = "token $Token"
  Accept                 = 'application/vnd.github+json'
  'User-Agent'           = 'dsh-ai4s-stack-push'
  'X-GitHub-Api-Version' = '2022-11-28'
}

# ---- 1. ensure repository
if (-not $SkipRepoCreate) {
  Say-Step "check repository $Owner/$Repo"
  $exists = $false
  try {
    $null = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo" -Headers $headers -Method Get -TimeoutSec 30
    $exists = $true
    Say-Ok 'repository exists, skipping creation'
  } catch {
    $status = $null
    try { $status = $_.Exception.Response.StatusCode.value__ } catch { }
    if ($status -ne 404) {
      Say-Info ("repository lookup returned HTTP $status - skipped creation, pushing directly")
    }
  }
  if (-not $exists -and $status -eq 404) {
    Say-Info 'repository missing, creating ...'
    $body = @{
      name        = $Repo
      description = $Description
      homepage    = "https://github.com/$Owner/$Repo"
      private     = [bool]$Private
      has_issues  = $true
      has_wiki    = $false
    } | ConvertTo-Json
    try {
      $created = Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Headers $headers -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 30
      Say-Ok "created $($created.full_name)  ($($created.html_url))"
    } catch {
      Fail ("repo creation failed: " + $_.Exception.Message)
    }
  }
}

# ---- 2. push
$cleanUrl = "https://github.com/$Owner/$Repo.git"
$authUrl  = "https://x-access-token:$Token@github.com/$Owner/$Repo.git"

Say-Step 'push main and tags'
git remote remove origin 2>$null | Out-Null
git remote add origin $cleanUrl

$env:GIT_TERMINAL_PROMPT = '0'
$code = Invoke-GitStream @('push', $authUrl, 'HEAD:refs/heads/main', '--force')
if ($code -ne 0) { Fail 'git push failed. Check token rights (Contents=write) and network.' }
Say-Ok 'main pushed'

$tagCode = Invoke-GitStream @('push', $authUrl, '--tags')
if ($tagCode -ne 0) { Say-Info 'tag push failed (usually harmless, retry later)' } else { Say-Ok 'tags pushed' }

# ---- 3. summary
Say-Step 'result'
$repoUrl = "https://github.com/$Owner/$Repo"
Write-Host "  repo:        $repoUrl"
Write-Host "  installers:  $repoUrl/raw/main/install.ps1"
Write-Host "               $repoUrl/raw/main/install.sh"
Write-Host ''
Write-Host '  one-click install:' -ForegroundColor White
Write-Host '    Windows:'
Write-Host "      & ([scriptblock]::Create((irm $repoUrl/raw/main/install.ps1)))"
Write-Host '    macOS / Linux / WSL:'
Write-Host "      curl -fsSL $repoUrl/raw/main/install.sh | bash"
Write-Host ''
