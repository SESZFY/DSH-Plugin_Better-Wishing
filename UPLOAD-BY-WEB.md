# 只用网页也能传：三步搞定主页 + 仓库 + 站点

> **现状（已完成）**：仓库、主页、Pages 站点都已上线 ——
> <https://github.com/SESZFY/dsh-ai4s-stack> ・ <https://github.com/SESZFY> ・ <https://seszfy.github.io/dsh-ai4s-stack/>
>
> 本文降级为**换机 / 无凭据 / 需要手工重传**时的备用流程。日常更新只要 `git push`（凭据已存在 Git Credential Manager 里）。

本机任何脚本都可能拿不到 GitHub 写凭据（无 `gh`、无 `GITHUB_TOKEN`、凭据管理器里也没有可被脚本直接读到的 github 条目），
此时自动化推送会失败。下面是纯浏览器路线，**三个目标**分开做，互不依赖：

| 目标 | 做什么 | 完成后地址 |
|---|---|---|
| A. 网页主页 | 建一个和你用户名同名的仓库 `SESZFY`，放 `README.md` | <https://github.com/SESZFY>（头像下方出现渲染的主页内容） |
| B. 代码仓库 | 建 `dsh-ai4s-stack`，把本目录传上去 | <https://github.com/SESZFY/dsh-ai4s-stack> |
| C. 网页站点 | 在 B 的 Settings → Pages 选 `main` + `/docs` | <https://seszfy.github.io/dsh-ai4s-stack/> |

**为什么之前"网页主页没有"**：GitHub 的 profile 主页由「与你用户名同名的仓库」里的 `README.md` 渲染，没有那个仓库就没有主页；`seszfy.github.io` 又是另一套（Pages 用户站），也需要单独建仓库并开 Pages。两个都没建过，所以两处都是空的。

---

## A. 先做主页（2 分钟，最省事）

1. 打开 <https://github.com/new>
2. **Repository name** 填 `SESZFY`（必须和用户名一模一样，大小写一致）
3. 勾 **Public** → 勾 **Add a README file** → **Create repository**
4. 打开新仓库里的 `README.md` → 铅笔图标编辑 → 全选删掉，粘贴 [`profile/README.md`](profile/README.md) 的内容 → **Commit changes**
5. 打开 <https://github.com/SESZFY> —— 头像下方就是你的主页

> 想改成站点式（`seszfy.github.io` 根域名）：再建一个名为 `SESZFY.github.io` 的仓库，把 `docs/index.html` 传到**仓库根目录**，Settings → Pages → Branch `main` + `/ (root)`。

---

## B. 传代码仓库

### B-1 建空仓库

1. <https://github.com/new>
2. **Repository name** 填 `dsh-ai4s-stack`
3. **Public**；**不要**勾 README / .gitignore / license（勾了会和本地历史冲突）
4. **Create repository** —— 停在 "quick setup" 页

### B-2 上传文件

在 quick setup 页点 **uploading an existing file**，然后把
`E:\科研\publish\dsh-ai4s-stack` 里的**内容**（不是这个文件夹本身）拖进去。

GitHub 网页上传有两条硬限制，先看清楚：

| 限制 | 影响 | 处理 |
|---|---|---|
| 单次 commit 最多 100 个文件 | 本仓 146 个文件，一次拖不完 | 分五批（见下表） |
| 拖拽会**跳过点开头**的文件/目录 | `.gitignore`、`.gitattributes`、`packages/dsh-skill-mcp-panel/.github/`、`packages/dsh-skill-mcp-panel/.gitignore` 会丢 | 可手动补，也可以不补——这些只影响开发，不影响 `dsh plugin add` 安装 |

| 批次 | 拖什么 | 文件数 |
|---|---|---|
| 1 | 根目录 8 个文件（`install.*`/`push.*`/`README.md`/`LICENSE`/`.gitattributes`/`.gitignore`）+ `docs/` + `profile/` | 11 |
| 2 | `packages/dsh-skill-mcp-panel/` 下的 `lib/`、`src/`、`assets/`、`scripts/` 及该目录根上的 8 个文件 | 68 |
| 3 | `packages/dsh-skill-mcp-panel/` 下的 `docs/`、`examples/`、`test/`、`.github/` | 45 |
| 4 | `packages/dsh-ai4s-composer/` 整个目录 | 12 |
| 5 | `packages/dsh-research-runner/` 整个目录 | 10 |

每批拖完点 **Commit changes**，再重新进仓库点 **Add file → Upload files** 传下一批。

> 只装插件不读文档的话，批次 3 可以整个跳过（少 45 个文件，`dsh plugin add` 仍能装）。

> 传完后安装器就能用了：`dsh plugin --profile web add https://github.com/SESZFY/dsh-ai4s-stack`（或直接跑 raw 上的一键安装脚本）。

### B-3 更省事的替代（任选其一）

- **GitHub Desktop**：Clone 空的 `dsh-ai4s-stack` → 把 `E:\科研\publish\dsh-ai4s-stack` 的内容拷进 Clone 目录 → Commit → Push。文件夹结构、点文件全都不丢。
- **给一个 token 跑现成脚本**：建 token（classic 勾 `repo`，或 fine-grained 给 Contents=write + Administration=write）后
  ```powershell
  $env:GITHUB_TOKEN = "ghp_xxx"; cd E:\科研\publish\dsh-ai4s-stack; .\push.ps1
  ```
  它会 API 建仓 + 推 `main` + 推 `v1.0.0` 标签，132 个文件和三个提交历史一次到位。

---

## C. 开网页站点（Pages）

1. 打开 `https://github.com/SESZFY/dsh-ai4s-stack/settings/pages`
2. **Source** 选 `Deploy from a branch`
3. **Branch** 选 `main`，**Folder** 选 `/docs` → **Save**
4. 等 30–60 秒刷新，顶部出现 "Your site is live at ..."
5. 访问 <https://seszfy.github.io/dsh-ai4s-stack/>

已经准备好的页面：[`docs/index.html`](docs/index.html)（单文件、零外部依赖、带一键安装复制按钮）。

> Pages 首次发布需要仓库已有一个提交；B 传完再操作 C。若 404 持续超过 2 分钟，看 Settings → Pages 顶部是否报了构建失败（`/docs` 下必须有 `index.html`，本仓已具备）。

---

## 传完之后自检

```bash
# 主页
curl -s -o /dev/null -w "%{http_code}\n" https://github.com/SESZFY
# 仓库
curl -s -o /dev/null -w "%{http_code}\n" https://github.com/SESZFY/dsh-ai4s-stack
# 站点
curl -s -o /dev/null -w "%{http_code}\n" https://seszfy.github.io/dsh-ai4s-stack/
# 一键安装脚本可达
curl -s -o /dev/null -w "%{http_code}\n" https://raw.githubusercontent.com/SESZFY/dsh-ai4s-stack/main/install.sh
```

四个都是 `200` 就成了。
