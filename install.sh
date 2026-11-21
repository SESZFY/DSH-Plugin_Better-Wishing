#!/usr/bin/env bash
# dsh-ai4s-stack 一键安装器（macOS / Linux / WSL / Git Bash）
#
#   curl -fsSL https://raw.githubusercontent.com/SESZFY/dsh-ai4s-stack/main/install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- --profile web --mode cluster --cluster openrouter/deepseek-v3.2
#
set -euo pipefail

MCP_PANEL="dsh-skill-mcp-panel"
AI4S="dsh-ai4s-composer"
RESEARCH="dsh-research-runner"
REPO_URL="https://github.com/SESZFY/dsh-ai4s-stack"
REF="main"
PROFILE=""
MODE=""
DELEGATE_MODEL=""
CLUSTER_MODEL=""
SOURCE=""
STAGE_DIR=""
DSH_BIN="${DSH_BIN:-}"
WITH="mcp-panel,ai4s,research"
UNINSTALL=0
NO_FETCH=0
CHECK=0

c_reset='\033[0m'; c_cyan='\033[36m'; c_green='\033[32m'; c_yellow='\033[33m'; c_red='\033[31m'; c_gray='\033[90m'
step() { printf "\n${c_cyan}==> %s${c_reset}\n" "$*"; }
ok()   { printf "  ${c_green}[OK]${c_reset}   %s\n" "$*"; }
info() { printf "  ${c_gray}[..]   %s${c_reset}\n" "$*"; }
warn() { printf "  ${c_yellow}[!!]${c_reset}   %s\n" "$*"; }
die()  { printf "\n${c_red}[FAIL] %s${c_reset}\n" "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
用法: install.sh [选项]

  --profile <name>        目标 DSH profile（默认自动探测，优先 web）
  --mode <m>              quick | solo | delegate | cluster
  --delegate <p/m>        主从模式子代理模型（provider/model）
  --cluster <p/m>         集群模式子代理模型（provider/model）
  --with <list>           逗号分隔: mcp-panel,ai4s,research（默认三个都装）
  --ref <branch|tag>      源码版本，默认 main
  --source <dir>          用本地目录安装（不下载）
  --stage <dir>           源码存放目录（默认 ~/.local/share/dsh-ai4s-stack/<ref>）
  --dsh-bin <path>        dsh CLI 的 bin.js 路径
  --uninstall             卸载
  --no-fetch              不下载，沿用 --stage 里已有源码
  --check                 只探测环境
  -h, --help              本帮助
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --profile)  PROFILE="${2:?}"; shift 2 ;;
    --mode)     MODE="${2:?}"; shift 2 ;;
    --delegate) DELEGATE_MODEL="${2:?}"; shift 2 ;;
    --cluster)  CLUSTER_MODEL="${2:?}"; shift 2 ;;
    --with)     WITH="${2:?}"; shift 2 ;;
    --ref)      REF="${2:?}"; shift 2 ;;
    --source)   SOURCE="${2:?}"; shift 2 ;;
    --stage)    STAGE_DIR="${2:?}"; shift 2 ;;
    --dsh-bin)  DSH_BIN="${2:?}"; shift 2 ;;
    --uninstall) UNINSTALL=1; shift ;;
    --no-fetch) NO_FETCH=1; shift ;;
    --check)    CHECK=1; shift ;;
    -h|--help)  usage; exit 0 ;;
    *) die "不认识的参数: $1（--help 看用法）" ;;
  esac
done

DSH_HOME_DIR="${DSH_HOME:-$HOME/.dsh}"
PROFILES_DIR="$DSH_HOME_DIR/profiles"

pkg_dir() {
  case "$1" in
    mcp-panel) printf 'packages/dsh-skill-mcp-panel' ;;
    ai4s)      printf 'packages/dsh-ai4s-composer' ;;
    research)  printf 'packages/dsh-research-runner' ;;
  esac
}
pkg_name() {
  case "$1" in
    mcp-panel) printf '%s' "$MCP_PANEL" ;;
    ai4s)      printf '%s' "$AI4S" ;;
    research)  printf '%s' "$RESEARCH" ;;
  esac
}
pkg_label() {
  case "$1" in
    mcp-panel) printf '技能 + MCP 面板' ;;
    ai4s)      printf '全自动 AI4S 模式' ;;
    research)  printf '图表复现（/research）' ;;
  esac
}

resolve_dsh_cli() {
  if [ -n "$DSH_BIN" ]; then
    [ -e "$DSH_BIN" ] || die "--dsh-bin 不存在: $DSH_BIN"
    printf '%s' "$DSH_BIN"; return
  fi
  if command -v dsh >/dev/null 2>&1; then command -v dsh; return; fi
  for root in "${DSH_APP_DIR:-}" \
              "$HOME/.local/share/dsh" "$HOME/.dsh/app" \
              "/usr/local/lib/dsh" "/opt/dsh" \
              "/Applications/DSH.app/Contents/Resources/app/dsh" \
              "${LOCALAPPDATA:-}/Programs/dsh/resources/app/dsh" \
              "${LOCALAPPDATA:-}/Programs/DeepSeek Harness/resources/app/dsh"; do
    [ -n "$root" ] || continue
    cand="$root/node_modules/@deepseek-ai/dsh/lib/bin.js"
    if [ -f "$cand" ]; then printf '%s' "$cand"; return; fi
  done
  # Git Bash / WSL 下的 Windows Electron 安装（目录名可能带中文）
  for drive in /c /d /e; do
    [ -d "$drive" ] || continue
    for name in "DSH 科研站" "DSH" "DeepSeek Harness"; do
      cand="$drive/$name/resources/app/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js"
      if [ -f "$cand" ]; then printf '%s' "$cand"; return; fi
    done
  done
  printf ''
}

run_dsh() {
  if [ -n "$DSH_CLI" ] && [ "${DSH_CLI##*.}" = "js" ]; then
    node "$DSH_CLI" "$@"
  else
    "$DSH_CLI" "$@"
  fi
}

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then return; fi
  warn "未找到 pnpm，\`dsh plugin\` 依赖它。正在安装 ..."
  command -v npm >/dev/null 2>&1 || die "未找到 npm。请先安装 Node.js 20+（https://nodejs.org）。"
  npm install -g pnpm --no-audit --no-fund >/dev/null 2>&1 || die "npm install -g pnpm 失败，请手动安装 pnpm。"
  command -v pnpm >/dev/null 2>&1 || die "pnpm 安装后仍不可用，请手动安装。"
}

resolve_profile() {
  if [ -n "$PROFILE" ]; then
    if [ "$PROFILE" = "desktop" ]; then
      die "profile \"desktop\" 由 Electron 独占，命令行无法安装；请用桌面端 GUI 或换 web/headless profile。"
    fi
    printf '%s' "$PROFILE"; return
  fi
  local candidates=""
  if [ -d "$PROFILES_DIR" ]; then
    candidates=$(find "$PROFILES_DIR" -mindepth 1 -maxdepth 1 -type d ! -name desktop -exec basename {} \; 2>/dev/null | sort | tr '\n' ' ')
  fi
  # shellcheck disable=SC2086
  set -- $candidates
  if [ $# -eq 1 ]; then printf '%s' "$1"; return; fi
  for c in "$@"; do
    if [ "$c" = "web" ]; then printf 'web'; return; fi
  done
  printf 'web'
}

resolve_root() {
  if [ -n "$SOURCE" ]; then
    [ -d "$SOURCE" ] || die "--source 不存在: $SOURCE"
    if [ -f "$SOURCE/packages/dsh-ai4s-composer/package.json" ]; then printf '%s' "$SOURCE"; return; fi
    if [ -f "$SOURCE/dsh-ai4s-stack/packages/dsh-ai4s-composer/package.json" ]; then printf '%s/dsh-ai4s-stack' "$SOURCE"; return; fi
    die "--source 里没有 packages/dsh-ai4s-composer: $SOURCE"
  fi
  local target="${STAGE_DIR:-$HOME/.local/share/dsh-ai4s-stack/$REF}"
  if [ "$NO_FETCH" = "1" ]; then
    [ -f "$target/packages/dsh-ai4s-composer/package.json" ] || die "--no-fetch 但 $target 里没有源码"
    printf '%s' "$target"; return
  fi
  if [ -f "$target/packages/dsh-ai4s-composer/package.json" ]; then
    ok "复用已下载源码: $target" >&2
    printf '%s' "$target"; return
  fi

  local tmp; tmp=$(mktemp -d)
  local url
  for url in "$REPO_URL/archive/refs/heads/$REF.tar.gz" "$REPO_URL/archive/refs/tags/$REF.tar.gz"; do
    info "下载 $url" >&2
    if curl -fsSL --max-time 120 "$url" -o "$tmp/src.tar.gz"; then break; fi
    warn "下载失败: $url" >&2
  done
  [ -s "$tmp/src.tar.gz" ] || die "源码下载失败。可改为: git clone $REPO_URL && ./install.sh --source ./dsh-ai4s-stack"
  tar -xzf "$tmp/src.tar.gz" -C "$tmp"
  local inner; inner=$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -n 1)
  [ -n "$inner" ] || die "压缩包结构异常"
  mkdir -p "$(dirname "$target")"
  rm -rf "$target"
  mv "$inner" "$target"
  rm -rf "$tmp"
  ok "源码就位于 $target" >&2
  printf '%s' "$target"
}

printf "\n  dsh-ai4s-stack  一键安装\n  ---------------------------------------------\n"
info "DSH_HOME : $DSH_HOME_DIR"
info "现有 profile : $(ls -1 "$PROFILES_DIR" 2>/dev/null | tr '\n' ' ' || true)"

DSH_CLI=$(resolve_dsh_cli)
if [ -n "$DSH_CLI" ]; then info "dsh CLI  : $DSH_CLI"; else warn "dsh CLI  : 未找到"; fi
if command -v node >/dev/null 2>&1; then info "node     : $(command -v node) ($(node -v))"; else warn "node     : 未找到"; fi
if command -v pnpm >/dev/null 2>&1; then info "pnpm     : $(command -v pnpm)"; else warn "pnpm     : 未找到（安装时自动装）"; fi

if [ "$CHECK" = "1" ]; then
  step "只检查，不安装（--check）"
  if [ -n "$DSH_CLI" ]; then ok "可以安装"; else warn "未找到 dsh CLI，请用 --dsh-bin 指定 bin.js"; fi
  exit 0
fi

command -v node >/dev/null 2>&1 || die "未找到 node。请先安装 Node.js 20+。"

TARGET_PROFILE=$(resolve_profile)
info "目标 profile : $TARGET_PROFILE"

# 解析 --with
SELECTED=""
OLD_IFS="$IFS"; IFS=','
for item in $WITH; do
  item=$(printf '%s' "$item" | tr -d '[:space:]')
  case "$item" in
    mcp-panel|ai4s|research) SELECTED="$SELECTED $item" ;;
    "") ;;
    *) IFS="$OLD_IFS"; die "--with 只接受 mcp-panel / ai4s，收到: $item" ;;
  esac
done
IFS="$OLD_IFS"
[ -n "${SELECTED// /}" ] || die "--with 为空，没有要安装的插件。"

if [ "$UNINSTALL" = "1" ]; then
  [ -n "$DSH_CLI" ] || die "卸载需要 dsh CLI，请用 --dsh-bin 指定。"
  step "从 profile \"$TARGET_PROFILE\" 卸载"
  names=""
  for k in $SELECTED; do names="$names $(pkg_name "$k")"; done
  # shellcheck disable=SC2086
  run_dsh plugin --profile "$TARGET_PROFILE" remove $names
  ok "已卸载:$names"
  printf "\n重启 DSH 后生效。\n"
  exit 0
fi

[ -n "$DSH_CLI" ] || die "未找到 dsh CLI。请用 --dsh-bin 指定，或设置 DSH_APP_DIR。"

ensure_pnpm
ok "pnpm 就绪"

ROOT=$(resolve_root)

step "安装到 profile \"$TARGET_PROFILE\""
INSTALLED=""
for k in $SELECTED; do
  dir="$ROOT/$(pkg_dir "$k")"
  [ -f "$dir/package.json" ] || die "源码缺包: $dir"
  info "安装 $(pkg_label "$k")  ($(pkg_name "$k"))"
  run_dsh plugin --profile "$TARGET_PROFILE" add "$dir"
  INSTALLED="$INSTALLED $(pkg_name "$k")"
done
ok "已安装:$INSTALLED"

step "校验 profile 挂载"
manifest="$PROFILES_DIR/$TARGET_PROFILE/package.json"
if [ -f "$manifest" ]; then
  for n in $INSTALLED; do
    if grep -q "\"$n\"" "$manifest"; then ok "bundles 含 $n"; else warn "bundles 未含 $n —— 检查 $manifest"; fi
  done
fi

SET_MODE="$ROOT/packages/dsh-ai4s-composer/scripts/set-mode.mjs"
if { [ -n "$MODE" ] || [ -n "$DELEGATE_MODEL" ] || [ -n "$CLUSTER_MODEL" ]; } && [ -f "$SET_MODE" ]; then
  step "写入 AI4S 模式偏好"
  args=("$SET_MODE")
  [ -n "$MODE" ] && args+=(--mode "$MODE")
  [ -n "$DELEGATE_MODEL" ] && args+=(--delegate "$DELEGATE_MODEL")
  [ -n "$CLUSTER_MODEL" ] && args+=(--cluster "$CLUSTER_MODEL")
  node "${args[@]}" || warn "模式写入失败，可稍后手动运行 set-mode.mjs"
fi

printf "\n  ---------------------------------------------\n"
printf "  安装完成。\n\n"
printf "  下一步：\n"
printf "    1) 重启 DSH：  dsh %s\n" "$TARGET_PROFILE"
printf "    2) 侧栏会出现「技能 / MCP」面板\n"
printf "    3) AI4S 模式切换：\n"
printf "         node \"%s\" --show\n" "$SET_MODE"
printf "         node \"%s\" --mode cluster --cluster <provider/model>\n\n" "$SET_MODE"
printf "  卸载：  ./install.sh --uninstall --profile %s\n\n" "$TARGET_PROFILE"
printf "  源码目录（保留，profile 以 link: 引用）：%s\n\n" "$ROOT"
