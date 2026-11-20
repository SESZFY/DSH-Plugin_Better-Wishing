#Requires -Version 5.1
<#
.SYNOPSIS
  dsh-ai4s-stack 一键安装器（Windows / PowerShell）

.DESCRIPTION
  把两个 DSH 插件装进指定 profile：
    * dsh-skill-mcp-panel   —— 技能 + MCP 管理面板（含 dsh-panel CLI）
    * dsh-ai4s-composer     —— 全自动 AI4S 模式（quick / solo / delegate / cluster）

  安装动作全部通过官方 `dsh plugin --profile <name> add <spec>` 完成：
  profile 的 dependencies 与 dsh.profile.bundles 由 DSH 自己的 plugin-manager 维护。

.EXAMPLE
  # 最省事：全部默认（自动探测 profile，装两个插件）
  & ([scriptblock]::Create((irm https://raw.githubusercontent.com/Fishquito7/dsh-ai4s-stack/main/install.ps1)))

.EXAMPLE
  # 指定 profile 并直接切到集群模式
  & ([scriptblock]::Create((irm https://raw.githubusercontent.com/Fishquito7/dsh-ai4s-stack/main/install.ps1))) `
      -Profile web -Mode cluster -ClusterModel "openrouter/deepseek-v3.2"

.EXAMPLE
  # 从本地已 clone 的仓库装（不联网）
  .\install.ps1 -Source . -Profile web

.EXAMPLE
  # 只看环境探测结果，不安装
  .\install.ps1 -Check

.EXAMPLE
  # 卸载
  .\install.ps1 -Uninstall
#>
[CmdletBinding()]
param(
  [string]$Profile,
  [string]$Mode,
  [string]$DelegateModel,
  [string]$ClusterModel,
  [string]$Ref = 'main',
  [string]$Source,
  [string]$RepoUrl = 'https://github.com/Fishquito7/dsh-ai4s-stack',
  [string]$StageDir,
  [string]$DshBin,
  [string[]]$With = @('mcp-panel', 'ai4s'),
  [switch]$Uninstall,
  [switch]$NoFetch,
  [switch]$Check
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

$script:PackageMap = [ordered]@{
  'mcp-panel' = @{ Dir = 'packages/dsh-skill-mcp-panel'; Name = 'dsh-skill-mcp-panel'; Label = '技能 + MCP 面板' }
  'ai4s'      = @{ Dir = 'packages/dsh-ai4s-composer';  Name = 'dsh-ai4s-composer';  Label = '全自动 AI4S 模式' }
}

# ---------------------------------------------------------------- 输出
function Say-Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Say-Ok($m)   { Write-Host "  [OK]   $m" -ForegroundColor Green }
function Say-Info($m) { Write-Host "  [..]   $m" -ForegroundColor Gray }
function Say-Warn($m) { Write-Host "  [!!]   $m" -ForegroundColor Yellow }
function Fail($m) {
  Write-Host "`n[FAIL] $m" -ForegroundColor Red
  exit 1
}

# ---------------------------------------------------------------- 环境探测
function Get-DshHome {
  if ($env:DSH_HOME) { return $env:DSH_HOME }
  return (Join-Path $HOME '.dsh')
}

function Resolve-DshCli {
  if ($DshBin) {
    if (-not (Test-Path -LiteralPath $DshBin)) { Fail "指定的 -DshBin 不存在: $DshBin" }
    return (Resolve-Path -LiteralPath $DshBin).Path
  }
  $cmd = Get-Command dsh -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $roots = @()
  if ($env:DSH_APP_DIR) { $roots += $env:DSH_APP_DIR }
  foreach ($drive in @('C', 'D', 'E')) {
    foreach ($name in @('DSH 科研站', 'DSH', 'DeepSeek Harness')) {
      $roots += "${drive}:\$name\resources\app\dsh"
      $roots += "${drive}:\Program Files\$name\resources\app\dsh"
    }
  }
  $roots += (Join-Path $env:LOCALAPPDATA 'Programs\dsh\resources\app\dsh')
  $roots += (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\app\dsh')

  foreach ($root in $roots) {
    $candidate = Join-Path $root 'node_modules\@deepseek-ai\dsh\lib\bin.js'
    if (Test-Path -LiteralPath $candidate) { return $candidate }
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
      Fail @"
profile "desktop" 由 Electron 独占，命令行无法安装。
请在 DSH 桌面端的「设置 → 插件」里安装，或改用 web/headless profile：
  install.ps1 -Profile web
"@
    }
    if ($Available -notcontains $Requested) {
      Say-Warn "profile ""$Requested"" 目前不存在，DSH 会按内置模板新建一个。"
    }
    return $Requested
  }
  $candidates = @($Available | Where-Object { $_ -ne 'desktop' })
  if ($candidates.Count -eq 1) { return $candidates[0] }
  if ($candidates -contains 'web') {
    Say-Info "未指定 -Profile，自动选用 web。"
    return 'web'
  }
  if ($candidates.Count -eq 0) {
    Say-Info "未发现可用 profile，使用 web。"
    return 'web'
  }
  Fail ("检测到多个 profile，请用 -Profile 指定其中一个: " + ($candidates -join ', '))
}

function Ensure-Pnpm {
  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($pnpm) { return $pnpm.Source }
  $guess = Join-Path $env:APPDATA 'npm\pnpm.cmd'
  if (Test-Path -LiteralPath $guess) { return $guess }

  Say-Warn '未找到 pnpm，`dsh plugin` 依赖它。正在安装 pnpm ...'
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if (-not $npm) { Fail '未找到 npm。请先安装 Node.js 20+（https://nodejs.org），再重跑本脚本。' }
  & npm install -g pnpm --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Fail 'npm install -g pnpm 失败，请手动安装 pnpm 后重试。' }

  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($pnpm) { return $pnpm.Source }
  if (Test-Path -LiteralPath $guess) { return $guess }
  Fail 'pnpm 安装后仍无法定位，请手动安装后重试。'
}

# ---------------------------------------------------------------- 取源
function Resolve-StackRoot {
  if ($Source) {
    if (-not (Test-Path -LiteralPath $Source)) { Fail "指定的 -Source 不存在: $Source" }
    $resolved = (Resolve-Path -LiteralPath $Source).Path
    if (Test-Path -LiteralPath (Join-Path $resolved 'packages\dsh-ai4s-composer\package.json')) { return $resolved }
    if (Test-Path -LiteralPath (Join-Path $resolved 'dsh-ai4s-stack\packages\dsh-ai4s-composer\package.json')) {
      return (Join-Path $resolved 'dsh-ai4s-stack')
    }
    Fail "-Source 指向的目录里没有 packages\dsh-ai4s-composer: $resolved"
  }
  if ($NoFetch) {
    if (-not $StageDir) { Fail '-NoFetch 需要同时给 -StageDir（已下载的源码目录）。' }
    return (Resolve-Path -LiteralPath $StageDir).Path
  }

  $target = if ($StageDir) { $StageDir } else { Join-Path $env:LOCALAPPDATA "dsh-ai4s-stack\$Ref" }
  $marker = Join-Path $target 'packages\dsh-ai4s-composer\package.json'
  if (Test-Path -LiteralPath $marker) {
    Say-Ok "复用已下载源码: $target"
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
      Say-Info "下载 $url"
      Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing -TimeoutSec 120
      $ok = $true
      break
    } catch {
      Say-Warn ("下载失败: " + $_.Exception.Message)
    }
  }
  if (-not $ok) {
    Fail @"
源码下载失败。可选做法：
  1) 配好代理后重试；本机 git 走代理需要:
     git config --global http.https://github.com.proxy http://127.0.0.1:7897
  2) 手动 clone 后用本地路径安装:
     git clone $RepoUrl
     .\install.ps1 -Source .\dsh-ai4s-stack
"@
  }

  try { Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $tmp 'x') -Force } catch { Fail ("解压失败: " + $_.Exception.Message) }
  $inner = Get-ChildItem -LiteralPath (Join-Path $tmp 'x') -Directory | Select-Object -First 1
  if (-not $inner) { Fail '下载的压缩包结构异常（没有顶层目录）。' }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
  Move-Item -LiteralPath $inner.FullName -Destination $target
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Say-Ok "源码就位于 $target"
  return $target
}

# ---------------------------------------------------------------- 主流程
$dshHome = Get-DshHome
$profiles = Get-Profiles

Write-Host ''
Write-Host '  dsh-ai4s-stack  一键安装' -ForegroundColor White
Write-Host '  ---------------------------------------------' -ForegroundColor DarkGray
Say-Info "DSH_HOME : $dshHome"
Say-Info "现有 profile : $(if ($profiles.Count) { $profiles -join ', ' } else { '(无)' })"

$script:DshCliPath = Resolve-DshCli
if ($script:DshCliPath) { Say-Info "dsh CLI  : $script:DshCliPath" } else { Say-Warn 'dsh CLI  : 未找到' }

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) { Say-Info "node     : $($nodeCmd.Source) ($(& node -v))" } else { Say-Warn 'node     : 未找到' }

$pnpmPath = Get-Command pnpm -ErrorAction SilentlyContinue
if ($pnpmPath) { Say-Info "pnpm     : $($pnpmPath.Source)" } else { Say-Warn 'pnpm     : 未找到（安装时会自动装）' }

if ($Check) {
  Say-Step '只检查，不安装（-Check）'
  if ($script:DshCliPath) { Say-Ok '可以安装' } else { Say-Warn '未找到 dsh CLI，请用 -DshBin 指定 bin.js 路径' }
  exit 0
}

if (-not $nodeCmd) { Fail '未找到 node。请先安装 Node.js 20+（https://nodejs.org）。' }

$resolvedProfile = Resolve-Profile -Requested $Profile -Available $profiles
Say-Info "目标 profile : $resolvedProfile"

$selected = @($With | ForEach-Object { $_.Split(',') } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$unknown = @($selected | Where-Object { -not $script:PackageMap.Contains($_) })
if ($unknown.Count) { Fail ("-With 只接受 " + ($script:PackageMap.Keys -join ' / ') + "，收到: " + ($unknown -join ', ')) }
if (-not $selected.Count) { Fail '-With 为空，没有要安装的插件。' }

# ---- 卸载
if ($Uninstall) {
  if (-not $script:DshCliPath) { Fail '卸载需要 dsh CLI。请用 -DshBin 指定。' }
  Say-Step "从 profile ""$resolvedProfile"" 卸载"
  $names = @($selected | ForEach-Object { $script:PackageMap[$_].Name })
  Invoke-Dsh plugin --profile $resolvedProfile remove @names
  if ($LASTEXITCODE -ne 0) { Fail '卸载失败，见上方输出。' }
  Say-Ok "已卸载: $($names -join ', ')"
  Write-Host "`n重启 DSH 后生效。" -ForegroundColor Yellow
  exit 0
}

if (-not $script:DshCliPath) {
  Fail @"
未找到 dsh CLI。三种做法任选其一：
  1) 把 DSH 的 bin.js 路径传给脚本:  -DshBin "D:\DSH 科研站\resources\app\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js"
  2) 设置环境变量 DSH_APP_DIR 指向 resources\app\dsh 目录
  3) 用桌面端「设置 → 插件」安装
"@
}

$null = Ensure-Pnpm
Say-Ok 'pnpm 就绪'

$root = Resolve-StackRoot

Say-Step "安装到 profile ""$resolvedProfile"""
$installed = @()
foreach ($key in $selected) {
  $meta = $script:PackageMap[$key]
  $dir = Join-Path $root ($meta.Dir -replace '/', '\')
  if (-not (Test-Path -LiteralPath (Join-Path $dir 'package.json'))) { Fail "源码缺包: $dir" }
  Say-Info "安装 $($meta.Label)  ($($meta.Name))"
  Invoke-Dsh plugin --profile $resolvedProfile add $dir
  if ($LASTEXITCODE -ne 0) { Fail "安装 $($meta.Name) 失败，见上方输出。" }
  $installed += $meta.Name
}
Say-Ok "已安装: $($installed -join ', ')"

# ---- 校验
Say-Step '校验 profile 挂载'
$manifestPath = Join-Path (Join-Path $dshHome "profiles\$resolvedProfile") 'package.json'
if (Test-Path -LiteralPath $manifestPath) {
  $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $bundles = @($manifest.dsh.profile.bundles)
  foreach ($name in $installed) {
    if ($bundles -contains $name) { Say-Ok "bundles 含 $name" }
    else { Say-Warn "bundles 未含 $name —— 请检查 $manifestPath" }
  }
}

# ---- 模式设置
$setMode = $root + '\packages\dsh-ai4s-composer\scripts\set-mode.mjs'
if (($Mode -or $DelegateModel -or $ClusterModel) -and (Test-Path -LiteralPath $setMode)) {
  Say-Step '写入 AI4S 模式偏好'
  $modeArgs = @($setMode)
  if ($Mode) { $modeArgs += @('--mode', $Mode) }
  if ($DelegateModel) { $modeArgs += @('--delegate', $DelegateModel) }
  if ($ClusterModel) { $modeArgs += @('--cluster', $ClusterModel) }
  & node @modeArgs
  if ($LASTEXITCODE -ne 0) { Say-Warn '模式写入失败，可稍后手动运行 set-mode.mjs' }
}

Write-Host ''
Write-Host '  ---------------------------------------------' -ForegroundColor DarkGray
Write-Host '  安装完成。' -ForegroundColor Green
Write-Host ''
Write-Host '  下一步：' -ForegroundColor White
Write-Host "    1) 重启 DSH：  dsh $resolvedProfile"
Write-Host '    2) 侧栏会出现「技能 / MCP」面板'
Write-Host '    3) AI4S 模式切换：'
Write-Host "         node `"$setMode`" --show"
Write-Host "         node `"$setMode`" --mode cluster --cluster <provider/model>"
Write-Host ''
Write-Host '  卸载：' -ForegroundColor White
Write-Host "     .\install.ps1 -Uninstall -Profile $resolvedProfile"
Write-Host ''
Write-Host "  源码目录（保留它，profile 以 link: 方式引用）：$root" -ForegroundColor DarkGray
Write-Host ''
