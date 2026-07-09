# 隐私政策 (Privacy Policy)

**最后更新：** 2026-07-09

**SkillX** 是一款本地优先的桌面应用。你的技能内容、配置与文件全部保存在本地设备上。我们不运营任何收集个人数据的后端服务。

## 1. 我们**不**收集哪些数据

我们**不会**收集、传输或分享：
- 个人信息
- 使用行为统计或分析数据
- 你的 Skills 内容或文件内容
- 你的文件系统结构

## 2. 本地数据存放位置

SkillX 产生的所有数据都保存在本地设备上：
- **应用配置**：`~/.skillx/config.json`（其中可能包含你手动填入的 LLM Provider API Key）
- **翻译缓存**：`~/.skillx/cache/translations/`
- **Skills 内容**：存放在你配置的技能目录中

## 3. 联网行为说明

SkillX 主体离线运行，但以下功能**确实**会发起网络请求。这些请求都由你的**明确操作**触发，不含任何后台埋点或使用统计：

| 功能 | 触发时机 | 目标地址 |
|------|----------|----------|
| **检查更新** | 手动点击或启动时（可选） | GitHub Releases (`api.github.com`) |
| **市场浏览 / 安装** | 打开 Marketplace 或安装技能 | 你配置的市场源（默认为公开 GitHub 仓库） |
| **AI 翻译 / AI 分类** | 你点击翻译或分类 | **你自己配置的** LLM Provider（OpenAI / DeepSeek / 本地 Ollama 等） |
| **Provider 模型列表** | 你添加或测试 Provider | 该 Provider 的 Base URL |
| **登录（可选）** | 你选择用 OAuth 登录以解锁账号功能 | GitHub OAuth |
| **提交反馈** | 你在应用内提交反馈 | GitHub Issues API |

**未经你操作，我们不会发起任何请求**——特别地，SkillX 不含任何后台遥测（telemetry）。

## 4. 第三方 AI Provider

当你使用 AI 翻译 / 分类功能时，你的技能内容与你填入的 Provider API Key 会**直接**发往该 Provider 的接口（如 OpenAI），SkillX **不**代理也**不**保存这些流量。相关数据处理请参阅你所选 Provider 的隐私政策。

## 5. 第三方 AI 工具

SkillX 会在 Claude Code / Codex / Gemini / Cursor 等工具的配置目录内创建软链接。这些工具运行时会读取被链接的技能文件，其行为由各工具自身的隐私政策约束，SkillX 无法感知。

## 6. 数据由你掌控

- `~/.skillx/` 目录完全归你所有——可自由备份、迁移或删除。
- 卸载 SkillX **不会**自动删除 `~/.skillx/`，如需清除请手动删除。
- 你填入的 API Key 以明文存储在 `config.json` 中，**请勿分享该文件**。

## 7. 联系我们

如有疑问，请在 [GitHub 仓库](../../issues) 提交 Issue。
