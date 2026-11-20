# dsh-ai4s-stack

两个 [DSH（DeepSeek Harness）](https://github.com/deepseek-ai) 插件打包在一起，一条命令装完：

| 插件 | 作用 | 形态 |
|---|---|---|
| **`dsh-skill-mcp-panel`** | 技能 + MCP 管理面板：web 侧栏管理 skills / MCP servers / 技能分组，含统一 CLI `dsh-panel` | Host + Client（web） |
| **`dsh-ai4s-composer`** | 全自动 AI4S 模式：`quick` / `solo` / `delegate` / `cluster` 四种编排，自动派发只读子代理并把结论回灌主代理 | 纯 Host |

前者管「装什么能力」，后者管「怎么自动干活」。两个都能独立安装，一起装则是完整的科研自动化栈。

---

## 一键安装

### Windows（PowerShell）

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/Fishquito7/dsh-ai4s-stack/main/install.ps1)))
```

带参数（指定 profile、直接切集群模式并指定子代理模型）：

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/Fishquito7/dsh-ai4s-stack/main/install.ps1))) `
    -Profile web -Mode cluster -ClusterModel "openrouter/deepseek-v3.2"
```

### macOS / Linux / WSL / Git Bash

```bash
curl -fsSL https://raw.githubusercontent.com/Fishquito7/dsh-ai4s-stack/main/install.sh | bash
```

```bash
# 带参数
curl -fsSL https://raw.githubusercontent.com/Fishquito7/dsh-ai4s-stack/main/install.sh \
  | bash -s -- --profile web --mode cluster --cluster openrouter/deepseek-v3.2
```

### 已 clone 到本地

```powershell
.\install.ps1 -Profile web          # 不联网，直接用本地源码
```

```bash
./install.sh --profile web --source .
```

### 只想看会做什么

```powershell
.\install.ps1 -Check    # 探测 node / pnpm / dsh CLI / profile，不安装
```

```bash
./install.sh --check
```

装完重启 DSH（`dsh web`），侧栏会多出「技能 / MCP」面板，模式菜单里出现「全自动AI4S模式」。

---

## 安装器做了什么

1. **探测环境**：node、pnpm、`dsh` CLI、`$DSH_HOME/profiles/*`。
2. **缺 pnpm 就装**：`dsh plugin` 底层是 pnpm，脚本会自动 `npm i -g pnpm`（用户目录全局，无需管理员）。
3. **取源码**：下载本仓库 tarball 到 `%LOCALAPPDATA%\dsh-ai4s-stack\<ref>`（Linux: `~/.local/share/dsh-ai4s-stack/<ref>`）。这一步只做一次，之后复用。
4. **调官方安装命令**，两个包各一条：
   ```bash
   dsh plugin --profile <name> add <源码目录>/packages/dsh-skill-mcp-panel
   dsh plugin --profile <name> add <源码目录>/packages/dsh-ai4s-composer
   ```
   `dependencies` 与 `dsh.profile.bundles` 由 DSH 自己的 plugin-manager 维护，脚本不手改任何 profile 文件。
5. **校验**：回读 profile 的 `package.json`，确认两个包都进了 `dsh.profile.bundles`。
6. **可选写入模式偏好**：`-Mode` / `-ClusterModel` / `-DelegateModel`。

### 参数

| PowerShell | bash | 说明 |
|---|---|---|
| `-Profile` | `--profile` | 目标 profile；省略时自动探测，优先 `web` |
| `-Mode` | `--mode` | `quick` / `solo` / `delegate` / `cluster` |
| `-DelegateModel` | `--delegate` | 主从模式子代理模型，`provider/model` |
| `-ClusterModel` | `--cluster` | 集群模式子代理模型，`provider/model` |
| `-With` | `--with` | `mcp-panel,ai4s`（默认两个都装） |
| `-Ref` | `--ref` | 源码分支/标签，默认 `main` |
| `-Source` | `--source` | 用本地目录安装，不下载 |
| `-StageDir` | `--stage` | 源码存放目录 |
| `-DshBin` | `--dsh-bin` | `dsh` CLI 的 `bin.js` 路径（自动探测失败时用） |
| `-Uninstall` | `--uninstall` | 卸载 |
| `-Check` | `--check` | 只探测 |

---

## 手动安装（不用安装器）

```bash
# 从 npm 装面板（已发布版本）
dsh plugin --profile web add dsh-skill-mcp-panel

# 从 GitHub 装（源码目录形式，两个包都可以）
git clone https://github.com/Fishquito7/dsh-ai4s-stack.git
dsh plugin --profile web add ./dsh-ai4s-stack/packages/dsh-skill-mcp-panel
dsh plugin --profile web add ./dsh-ai4s-stack/packages/dsh-ai4s-composer
```

> `dsh plugin add` 支持四种 spec：registry 包名、git 地址、tarball、**绝对/相对路径**。

## 卸载

```powershell
.\install.ps1 -Uninstall -Profile web
```

```bash
./install.sh --uninstall --profile web
# 或
dsh plugin --profile web remove dsh-skill-mcp-panel dsh-ai4s-composer
```

卸载只从 profile 摘掉引用；源码目录可以手动删。

---

## AI4S 四种模式

| 模式 | 行为 |
|---|---|
| `quick` | 不开子代理，主代理直接做。 |
| `solo` | 原生行为，默认值。 |
| `delegate` | 每轮自动开 1 个只读子代理（分析/取证），结论回灌主代理。 |
| `cluster` | 先让规划模型把请求拆成互不重复的子任务，并行开多个只读子代理；主代理可用 `cluster_delegate` 工具分批追加。 |

子代理被 `tools.guard` + `tools.restrict` 双重限制为**只读**（`read` / `glob` / `grep` / `web_search` / `web_fetch`），执行动作必须回到主代理——这是设计约束，不是配置项。

### 改模式

GUI：模式选择菜单。

无 GUI：

```bash
node packages/dsh-ai4s-composer/scripts/set-mode.mjs --show
node packages/dsh-ai4s-composer/scripts/set-mode.mjs --mode cluster --cluster deepseek-official/deepseek-flash
node packages/dsh-ai4s-composer/scripts/set-mode.mjs --reset
```

偏好落盘在 `$DSH_HOME/clawsgo-composer.json`（**全局共享，不按 profile 分**），改完重启 DSH 生效。

---

## 仓库结构

```
dsh-ai4s-stack/
├── install.ps1                  一键安装（Windows）
├── install.sh                   一键安装（macOS/Linux/WSL/Git Bash）
├── packages/
│   ├── dsh-skill-mcp-panel/     技能 + MCP 面板（v2.3.16）
│   │   ├── src/ lib/ docs/      TypeScript 源码与预构建产物
│   │   └── cordis.patch.yml
│   └── dsh-ai4s-composer/       全自动 AI4S 模式（v1.0.0）
│       ├── index.js             435 行纯 Host 插件
│       ├── scripts/set-mode.mjs 无 GUI 改模式
│       └── cordis.patch.yml
└── LICENSE
```

两个包都是标准 DSH bundle：`package.json` 里带 `dsh.bundle.patch`，被 `dsh plugin add` 装进 profile 后自动追加到 `dsh.profile.bundles` 并套用 patch 层，**不需要手改 `cordis.patch.yml`**。

---

## 故障排查

| 现象 | 原因 / 处理 |
|---|---|
| `'pnpm' is not recognized` | 安装器会自动 `npm i -g pnpm`；手动装也可。 |
| `profile desktop 由 Electron 独占` | 桌面端不能用 CLI 装插件，改用 `web` / `headless` profile，或在 GUI 里装。 |
| 下载源码失败 | 走代理。git 需要单独配：`git config --global http.https://github.com.proxy http://127.0.0.1:7897`；或 `git clone` 后 `-Source`。 |
| 找不到 dsh CLI | `-DshBin ".../node_modules/@deepseek-ai/dsh/lib/bin.js"`，或设 `DSH_APP_DIR`。 |
| 装完侧栏没出现面板 | 重启 DSH；面板是 web 平台 client 插件，需要 web profile。 |
| 删了源码目录后插件报错 | profile 用 `link:` 引用源码目录，**别删**；要移动就重跑安装器换路径。 |
| 模式改了不生效 | 重启 DSH；偏好是挂载时读盘的。 |

---

## 许可证

MIT。见 [LICENSE](LICENSE)。`packages/dsh-skill-mcp-panel` 沿用其上游 MIT 许可（LICENSE 随包提供）。
