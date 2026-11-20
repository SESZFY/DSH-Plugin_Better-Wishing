#!/usr/bin/env bash
# 一条命令把本仓库发布到 GitHub：建仓（若不存在）+ 推送 main + tags。
#
#   GITHUB_TOKEN=ghp_xxx ./push.sh
#   ./push.sh --token ghp_xxx --private
#
set -euo pipefail

OWNER="${GITHUB_OWNER:-Fishquito7}"
REPO="${GITHUB_REPO:-dsh-ai4s-stack}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
DESC="DSH 插件合集：技能/MCP 管理面板 + 全自动 AI4S 模式，附一键安装"
PRIVATE=false
SKIP_CREATE=false

while [ $# -gt 0 ]; do
  case "$1" in
    --token)   TOKEN="${2:?}"; shift 2 ;;
    --owner)   OWNER="${2:?}"; shift 2 ;;
    --repo)    REPO="${2:?}"; shift 2 ;;
    --private) PRIVATE=true; shift ;;
    --skip-create) SKIP_CREATE=true; shift ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "不认识的参数: $1" >&2; exit 1 ;;
  esac
done

cd "$(dirname "$0")"

if [ -z "$TOKEN" ]; then
  cat >&2 <<'EOF'
缺少 GitHub Token：
  GITHUB_TOKEN=ghp_xxx ./push.sh
  或 ./push.sh --token ghp_xxx
Token 生成: https://github.com/settings/tokens （classic 勾 repo）
EOF
  exit 1
fi

[ -d .git ] || { echo "当前目录不是 git 仓库" >&2; exit 1; }

api() {
  local method="$1" path="$2" data="${3:-}"
  if [ -n "$data" ]; then
    curl -fsS -X "$method" -H "Authorization: token $TOKEN" \
      -H 'Accept: application/vnd.github+json' -H 'User-Agent: dsh-ai4s-stack-push' \
      -d "$data" "https://api.github.com$path"
  else
    curl -fsS -X "$method" -H "Authorization: token $TOKEN" \
      -H 'Accept: application/vnd.github+json' -H 'User-Agent: dsh-ai4s-stack-push' \
      "https://api.github.com$path"
  fi
}

echo ""
echo "==> 检查远端仓库 $OWNER/$REPO"
exists=false
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: token $TOKEN" \
  -H 'User-Agent: dsh-ai4s-stack-push' "https://api.github.com/repos/$OWNER/$REPO")
if [ "$code" = "200" ]; then
  echo "  [OK]   仓库已存在，跳过创建"
  exists=true
elif [ "$code" = "404" ]; then
  echo "  [..]   仓库不存在"
else
  echo "  [FAIL] 查询仓库返回 HTTP $code（检查 token 有效性/网络）" >&2
  exit 1
fi

if [ "$exists" = false ] && [ "$SKIP_CREATE" = false ]; then
  echo "  [..]   正在创建 ..."
  body=$(printf '{"name":"%s","description":"%s","private":%s,"has_issues":true,"has_wiki":false}' "$REPO" "$DESC" "$PRIVATE")
  if api POST /user/repos "$body" >/dev/null; then
    echo "  [OK]   已创建 $OWNER/$REPO"
  else
    echo "  [FAIL] 创建仓库失败（token 需要 Administration=write 或 repo 权限）" >&2
    exit 1
  fi
fi

CLEAN="https://github.com/$OWNER/$REPO.git"
AUTH="https://x-access-token:$TOKEN@github.com/$OWNER/$REPO.git"

echo ""
echo "==> 推送 main 与 tags"
git remote remove origin 2>/dev/null || true
git remote add origin "$CLEAN"

GIT_TERMINAL_PROMPT=0 git push "$AUTH" "HEAD:refs/heads/main" --force
echo "  [OK]   main 已推送"

git push "$AUTH" --tags || echo "  [..]   tags 推送失败（不致命，可稍后补）"

echo ""
echo "==> 结果"
echo "  仓库:       https://github.com/$OWNER/$REPO"
echo "  安装器:     https://github.com/$OWNER/$REPO/raw/main/install.sh"
echo ""
echo "  一键安装："
echo "    macOS/Linux:  curl -fsSL https://github.com/$OWNER/$REPO/raw/main/install.sh | bash"
echo "    Windows:      & ([scriptblock]::Create((irm https://github.com/$OWNER/$REPO/raw/main/install.ps1)))"
echo ""
