# 茂叠哈基醚 / SESZFY

> 给 DeepSeek Harness 写插件：把科研流程拆成可复用的工具层 + 可编排的自动化模式。

## 在维护的项目

| 项目 | 一句话 | 语言 |
|---|---|---|
| [dsh-ai4s-stack](https://github.com/SESZFY/dsh-ai4s-stack) | 技能/MCP 管理面板 + 全自动 AI4S 模式，两个 DSH 插件打包 + 一键安装 | JS / TS |
| [dsh-orgchem](https://github.com/SESZFY/dsh-orgchem) | 有机化学答题工具层 + 方法论 skill | Python |
| [dsh-structchem](https://github.com/SESZFY/dsh-structchem) | 结构化学答题 AI 插件 | Python |
| [karaoke-kit](https://github.com/SESZFY/karaoke-kit) | QQ song-rvc + Snowluma + SurfCore + Coopanion | JavaScript |

## 最近在做的

**dsh-ai4s-stack** —— 一条命令给 DSH 装上「装什么能力」和「怎么自动干活」两件东西：

```powershell
& ([scriptblock]::Create((irm https://github.com/SESZFY/dsh-ai4s-stack/raw/main/install.ps1)))
```

```bash
curl -fsSL https://github.com/SESZFY/dsh-ai4s-stack/raw/main/install.sh | bash
```

站点：<https://seszfy.github.io/dsh-ai4s-stack/>

## 联系

问题提在对应仓库的 Issues 里，我看得到。
