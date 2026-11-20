#Requires -Version 5.1
<#
.SYNOPSIS
  Publish this repository to GitHub in one command: create the repo if missing,
  push main, push tags.

.DESCRIPTION
  Needs a GitHub token with repo rights
  (classic: `repo`; fine-grained: Contents=write + Administration=write).
  The token is used in-process only and is never written into .git/config -
  after the push the remote stays a clean https URL.

  NOTE: ASCII-only on purpose (BOM breaks [scriptblock]::Create((irm ...)),
  BOM-less UTF-8 with non-ASCII breaks `powershell -File` on PS 5.1).

.EXAMPLE
  $env:GITHUB_TOKEN = "ghp_xxx"; .\push.ps1

.EXAMPLE
  .\push.ps1 -Token "ghp_xxx" -Private
#>
[CmdletBinding()]
param(
  [string]$Token,
  [string]$Owner = 'Fishquito7',
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

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

if (-not $Token) { $Token = $env:GITHUB_TOKEN; if (-not $Token) { $Token = $env:GH_TOKEN } }
if (-not $Token) {
  Fail @"
GitHub token missing. Two ways:
  1) `$env:GITHUB_TOKEN = "ghp_xxx"; .\push.ps1
  2) .\push.ps1 -Token "ghp_xxx"
Create a token at https://github.com/settings/tokens
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
      Fail ("repository lookup failed (HTTP $status): " + $_.Exception.Message)
    }
  }
  if (-not $exists) {
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
git push $authUrl "HEAD:refs/heads/main" --force 2>&1 | ForEach-Object { Say-Info $_ }
if ($LASTEXITCODE -ne 0) { Fail 'git push failed. Check token rights (Contents=write) and proxy settings.' }
Say-Ok 'main pushed'

git push $authUrl --tags 2>&1 | ForEach-Object { Say-Info $_ }
if ($LASTEXITCODE -ne 0) { Say-Info 'tag push failed (usually harmless, retry later)' } else { Say-Ok 'tags pushed' }

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
