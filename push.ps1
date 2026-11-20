#Requires -Version 5.1
<#
.SYNOPSIS
  一条命令把本仓库发布到 GitHub：建仓（若不存在）+ 推送 main + 推送 tags。

.DESCRIPTION
  需要一个具备 repo 权限的 GitHub Token（classic: repo；fine-grained: Administration=write + Contents=write）。
  Token 只在本次进程内存里用，不会写进 .git/config —— 推完 remote 仍是干净的 https 地址。

.EXAMPLE
  # 从环境变量读 token（推荐，不留在历史里）
  $env:GITHUB_TOKEN = "ghp_xxx"
  .\push.ps1

.EXAMPLE
  .\push.ps1 -Token "ghp_xxx" -Private
#>
[CmdletBinding()]
param(
  [string]$Token,
  [string]$Owner = 'Fishquito7',
  [string]$Repo = 'dsh-ai4s-stack',
  [string]$Description = 'DSH 插件合集：技能/MCP 管理面板 + 全自动 AI4S 模式，附一键安装',
  [switch]$Private,
  [switch]$SkipRepoCreate
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

function Say-Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Say-Ok($m)   { Write-Host "  [OK]   $m" -ForegroundColor Green }
function Say-Info($m) { Write-Host "  [..]   $m" -ForegroundColor Gray }
function Fail($m) { Write-Host "`n[FAIL] $m" -ForegroundColor Red; exit 1 }

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

if (-not $Token) { $Token = $env:GITHUB_TOKEN; if (-not $Token) { $Token = $env:GH_TOKEN } }
if (-not $Token) {
  Fail @"
缺少 GitHub Token。两种给法：
  1) `$env:GITHUB_TOKEN = "ghp_xxx"; .\push.ps1
  2) .\push.ps1 -Token "ghp_xxx"
Token 生成: https://github.com/settings/tokens （classic 勾 repo；fine-grained 给 Contents=write + Administration=write）
"@
}

if (-not (Test-Path -LiteralPath (Join-Path $root '.git'))) { Fail "当前目录不是 git 仓库: $root" }

$headers = @{
  Authorization          = "token $Token"
  Accept                 = 'application/vnd.github+json'
  'User-Agent'           = 'dsh-ai4s-stack-push'
  'X-GitHub-Api-Version' = '2022-11-28'
}

# ---- 1. 建仓
if (-not $SkipRepoCreate) {
  Say-Step "检查远端仓库 $Owner/$Repo"
  $exists = $false
  try {
    $null = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo" -Headers $headers -Method Get -TimeoutSec 30
    $exists = $true
    Say-Ok '仓库已存在，跳过创建'
  } catch {
    $status = $null
    try { $status = $_.Exception.Response.StatusCode.value__ } catch { }
    if ($status -ne 404) {
      Fail ("查询仓库失败（HTTP $status）: " + $_.Exception.Message)
    }
  }
  if (-not $exists) {
    Say-Info '仓库不存在，正在创建 ...'
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
      Say-Ok "已创建 $($created.full_name)  ($($created.html_url))"
    } catch {
      Fail ("创建仓库失败: " + $_.Exception.Message)
    }
  }
}

# ---- 2. 推送
$cleanUrl = "https://github.com/$Owner/$Repo.git"
$authUrl  = "https://x-access-token:$Token@github.com/$Owner/$Repo.git"

Say-Step '推送 main 与 tags'
git remote remove origin 2>$null | Out-Null
git remote add origin $cleanUrl

$env:GIT_TERMINAL_PROMPT = '0'
git push $authUrl "HEAD:refs/heads/main" --force 2>&1 | ForEach-Object { Say-Info $_ }
if ($LASTEXITCODE -ne 0) { Fail 'git push 失败。检查 token 权限（Contents=write）与网络/代理。' }
Say-Ok 'main 已推送'

git push $authUrl --tags 2>&1 | ForEach-Object { Say-Info $_ }
if ($LASTEXITCODE -ne 0) { Say-Info 'tags 推送失败（通常不致命，可稍后手动补）' } else { Say-Ok 'tags 已推送' }

# ---- 3. 收尾
Say-Step '结果'
$repoUrl = "https://github.com/$Owner/$Repo"
Write-Host "  仓库:        $repoUrl"
Write-Host "  raw 安装器:  $repoUrl/raw/main/install.ps1"
Write-Host "               $repoUrl/raw/main/install.sh"
Write-Host ''
Write-Host '  一键安装命令：' -ForegroundColor White
Write-Host '    Windows:'
Write-Host "      & ([scriptblock]::Create((irm $repoUrl/raw/main/install.ps1)))"
Write-Host '    macOS / Linux / WSL:'
Write-Host "      curl -fsSL $repoUrl/raw/main/install.sh | bash"
Write-Host ''
Write-Host "  注意：raw 地址的仓库名与本脚本的 -Repo 一致（当前 $Repo）。" -ForegroundColor DarkGray
Write-Host ''
