# dsh-ai4s-composer · 全自动 AI4S 模式

给 [DSH（DeepSeek Harness）](https://github.com/deepseek-ai) 加一层**编排**：一轮对话开始时自动判断要不要开子代理、开几个、用哪个模型，再把子代理的只读结论整理后回灌主代理。

编排在 DSH 后端运行。本包另附模型选择菜单补丁。

## 四种模式

| 模式 | 行为 |
|---|---|
| `quick` | 不开子代理，主代理直接干。 |
| `solo` | 默认值，等价于不装本插件的原生行为。 |
| `delegate` | 每轮自动开 **1 个**只读子代理（分析/证据），结论回灌。 |
| `cluster` | 先让规划模型把请求拆成若干互不重复的子任务，再**并行**开多个只读子代理；主代理还可在运行中调用 `cluster_delegate` 工具分批追加。 |

每个会话独立保存模式。`delegate` 与 `cluster` 可在该会话里各自选择子代理模型。旧版误共享的末次模式不会应用到新会话，新会话默认使用 `solo`，也可显式指定默认模式。

## 安装

本包属于 [`dsh-ai4s-stack`](../../README.md)。推荐走仓库根的一键安装，它会同时装好 skill/mcp 面板：

```powershell
# Windows PowerShell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/SESZFY/DSH-Plugin_Better-Wishing/main/install.ps1))) -Profile web
```

单独装这一个包：

```bash
dsh plugin --profile web add github:SESZFY/DSH-Plugin_Better-Wishing#path:/packages/dsh-ai4s-composer
# 或已 clone 到本地
dsh plugin --profile web add E:/path/to/dsh-ai4s-stack/packages/dsh-ai4s-composer
```

安装后重启 DSH，侧栏/插件列表里会出现「全自动AI4S模式」。

## 设置模式

### 安装模型选择菜单

菜单包含「模式」「模型」「推理强度」三个入口。模式面板可切换快速、单体、主从、集群，并在后两种模式中选择子代理模型。主模型与推理强度使用 DSH 原有选择器。

从仓库安装插件后，为 DSH 客户端组件 `@deepseek-ai/dsh-client-ui-model-selection@0.2.1-rc.3` 应用菜单补丁。`--root` 可以指向桌面安装目录或包含 DSH `node_modules` 的目录。也可以用 `--client` 直接指定该组件的 `lib/client.js`。

```powershell
node packages/dsh-ai4s-composer/scripts/install-model-menu.mjs --root "D:\DSH 科研站" --check
node packages/dsh-ai4s-composer/scripts/install-model-menu.mjs --root "D:\DSH 科研站"
```

补丁校验客户端版本和文件指纹，保留 `client.js.bak-ai4s-session-menu`，重复运行可检查安装状态。重启 DSH 后生效，升级 DSH 若覆盖文件，可以再次检查兼容性。

### 命令行

**无 GUI**（本包自带）：

```bash
# 查看指定会话的偏好
node packages/dsh-ai4s-composer/scripts/set-mode.mjs --session <会话ID> --show

# 当前会话切成集群模式，指定子代理模型
node packages/dsh-ai4s-composer/scripts/set-mode.mjs --session <会话ID> --mode cluster --cluster openrouter/deepseek-v3.2

# 显式设置未单独配置的会话所用的默认模式
node packages/dsh-ai4s-composer/scripts/set-mode.mjs --mode solo
```

会话偏好落盘在 `$DSH_HOME/clawsgo-composer-sessions/`，`--session <会话ID> --reset` 恢复继承默认值。默认值保存在 `$DSH_HOME/clawsgo-composer.json`，`DSH_HOME` 缺省为 `~/.dsh`。运行中的轮次继续使用开始时的设置，下一轮读取最新保存值。

## 工作方式

- **触发**：`agent/pre-step` 钩子，`step === 1` 且当前不是子代理时介入。
- **只读约束**：子代理通过 `tools.guard` 和 `tools.restrict` 使用 `read_document`、`read`、`glob`、`grep`、`web_search`、`web_fetch` 中当前会话可用的工具。
- **回灌**：结论通过 `systemPrompt.context`（`order: 10300`、`required: true`）注入主代理提示词。
- **HTTP 接口**：`GET/POST /api/clawsgo/composer?sessionId=<会话ID>` 读写指定会话的偏好，`POST` 使用 `application/json`，请求体上限 2048 B。
- **超时**：子代理空闲 360 s、排队 600 s 后放弃。
- **动态工具**：`cluster_delegate` 仅在 `cluster` 模式、主代理 running 时注册，用于追加子任务。

## 许可证

MIT。见 [LICENSE](LICENSE)。
