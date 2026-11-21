# dsh-research-runner · 图表复现

给 DSH 加一条 `/research` 命令和一个 `research_run` 工具：把一篇公开论文的图**按检查点重跑**，跑出图、算误差、留审计记录。任务在后台运行，DSH 重启后状态和产物都还在。

当前内置的复现目标：**Bosoni et al., _Nature Reviews Physics_ 6, 45–58 (2024), Fig. 3**（AiiDA 工作流论文里那张验证图）。

## 用法

| 命令 | 作用 |
|---|---|
| `/research start` | 新建一次复现（`--prepare-only` 只准备输入，不跑分析） |
| `/research status [ID]` | 看进度：已提交 3 阶段里的哪一步、产物在哪 |
| `/research list` | 列出当前会话的所有任务 |
| `/research pause [ID]` | 暂停 |
| `/research resume [ID]` | 从检查点继续 |

模型侧对应工具 `research_run`，参数 `{ "action": "start|status|list|pause|resume", "id": "可选" }`。

## 三个阶段与产物

任务目录下固定三段，每段结束都写 `checkpoint.json`（逐文件 sha256）：

```
<任务目录>/
├── inputs/      Er-diamond-EOS-data.json · reproduce.py · source.json · LICENSE-upstream.txt
├── analysis/    figure.png · curves.csv · metrics.json · execution.log
└── review/      report.md
```

`resume` 会先校验检查点：任何一个文件的哈希对不上就报「检查点损坏」，不会拿被改过的中间产物继续算。

## 前言要求

- **Node ≥ 22**：用的是内置 `node:sqlite`（`DatabaseSync`）存任务状态。
- **Python**：`reproduce.py` 需要 `numpy`、`scipy`、`matplotlib`。
- 只用 CPU，无网络（数据文件随包提供，`source.json` 里记了 DOI、Materials Cloud 归档、上游 commit 与数据 sha256）。

## 安装

属于 [`dsh-ai4s-stack`](../../README.md)，装整栈时会自动带上：

```powershell
& ([scriptblock]::Create((irm https://github.com/SESZFY/dsh-ai4s-stack/raw/main/install.ps1))) -Profile web
```

只装这一个：

```bash
dsh plugin --profile web add github:SESZFY/dsh-ai4s-stack#path:/packages/dsh-research-runner
# 或已 clone 到本地
dsh plugin --profile web add E:/path/to/dsh-ai4s-stack/packages/dsh-research-runner
```

> 之前它是用 `file:///.../index.mjs` 直接挂进 profile 的（散装目录，无 `package.json`）。
> 现在做成了标准 bundle，`dsh plugin add` 即可，不必手改 `cordis.patch.yml`。

## 来源与许可

- 数据与原始绘图脚本来自 [aiidateam/acwf-verification-scripts](https://github.com/aiidateam/acwf-verification-scripts)（commit `fdb6adf`），**MIT**，版权归 AiiDA team —— 见 [LICENSE-upstream.txt](LICENSE-upstream.txt)。
- 数据原始出处：[Materials Cloud Archive `yf0rj-w3r97`](https://archive.materialscloud.org/records/yf0rj-w3r97)，数据 sha256 记录在 `source.json` 里。
- 本包的运行器（`index.mjs` / `runner.mjs` / `reproduce.py`）为 MIT，见 [LICENSE](LICENSE)。
