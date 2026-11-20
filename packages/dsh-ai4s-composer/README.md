# dsh-ai4s-composer · 全自动 AI4S 模式

给 [DSH（DeepSeek Harness）](https://github.com/deepseek-ai) 加一层**编排**：一轮对话开始时自动判断要不要开子代理、开几个、用哪个模型，再把子代理的只读结论整理后回灌主代理。

纯 Host 侧 cordis 插件，无 npm 运行时依赖，只注入 DSH 自带服务：`connection` / `llm` / `subagents` / `systemPrompt` / `tools` / `sessionProjections`。

## 四种模式

| 模式 | 行为 |
|---|---|
| `quick` | 不开子代理，主代理直接干。 |
| `solo` | 默认值，等价于不装本插件的原生行为。 |
| `delegate` | 每轮自动开 **1 个**只读子代理（分析/证据），结论回灌。 |
| `cluster` | 先让规划模型把请求拆成若干互不重复的子任务，再**并行**开多个只读子代理；主代理还可在运行中调用 `cluster_delegate` 工具分批追加。 |

`delegate` 与 `cluster` 可以各自绑定不同的子代理模型。

## 安装

本包属于 [`dsh-ai4s-stack`](../../README.md)。推荐走仓库根的一键安装，它会同时装好 skill/mcp 面板：

```powershell
# Windows PowerShell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/SESZFY/dsh-ai4s-stack/main/install.ps1))) -Profile web
```

单独装这一个包：

```bash
dsh plugin --profile web add github:SESZFY/dsh-ai4s-stack#path:/packages/dsh-ai4s-composer
# 或已 clone 到本地
dsh plugin --profile web add E:/path/to/dsh-ai4s-stack/packages/dsh-ai4s-composer
```

安装后重启 DSH，侧栏/插件列表里会出现「全自动AI4S模式」。

## 设置模式

**有 GUI**：在 DSH 的模式选择菜单里点。菜单项由 DSH 客户端提供，若你的版本没有这一项，用下面的 CLI。

**无 GUI**（本包自带）：

```bash
# 看当前偏好
node packages/dsh-ai4s-composer/scripts/set-mode.mjs --show

# 切成集群模式，并指定子代理模型（provider/model）
node packages/dsh-ai4s-composer/scripts/set-mode.mjs --mode cluster --cluster openrouter/deepseek-v3.2

# 重置
node packages/dsh-ai4s-composer/scripts/set-mode.mjs --reset
```

偏好落盘在 `$DSH_HOME/clawsgo-composer.json`（`DSH_HOME` 缺省为 `~/.dsh`）。改完重启 DSH 生效。

## 工作方式

- **触发**：`agent/pre-step` 钩子，`step === 1` 且当前不是子代理时介入。
- **只读约束**：子代理被 `tools.guard` + `tools.restrict` 双重限制，只允许 `read` / `glob` / `grep` / `web_search` / `web_fetch`。执行动作一律回到主代理。
- **回灌**：结论通过 `systemPrompt.context`（`order: 10300`、`required: true`）注入主代理提示词。
- **HTTP 接口**：`GET/POST /api/clawsgo/composer` 读写偏好，`POST` 只收 `application/json`，body 上限 2048 B。
- **超时**：子代理空闲 360 s、排队 600 s 后放弃。
- **动态工具**：`cluster_delegate` 仅在 `cluster` 模式、主代理 running 时注册，用于追加子任务。

## 许可证

MIT。见 [LICENSE](LICENSE)。
