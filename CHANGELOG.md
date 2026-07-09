# Changelog

所有重要变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/)，
版本号遵循 [Semantic Versioning](https://semver.org/)。

## [Unreleased]

## [3.4.0] - 2026-07-03

### Added
- **主题系统**：新增 5 组主题（Apple / Comic / Cyberpunk / Default / Neumorphism），每组明暗共 10 套
- **工具绑定**：支持将 LLM Provider 与具体工具绑定，一键切换绑定的模型（`apply_model_to_tool` / `apply_claude_provider`）
- **多 Provider 管理**：新增 `save_llm_provider_multi` / `delete_llm_provider` / `multi_switch_llm_provider` / `get_active_provider`

### Fixed
- 修复 toggle 组件构建报错（未使用的 `isDark` 变量）
- 补齐所有主题 CSS 文件的导入

### Notes
- Windows / Linux 版本尚未发布，README 已明确标注 "Coming soon"

## [3.3.1] - 2026-07-01

> 覆盖 3.3.x 段所有稳定性修复；v3.3.0 未单独发布，其功能一并合并到 3.3.1。

### Added（含原 v3.3.0 功能）
- **AI 技能管家**：工具栏新增入口，整合 AI 批量翻译与 AI 分类
- **AI 批量翻译**：调用 LLM 批量翻译名称与描述，支持进度显示和错误重试
- **AI 分类管理**：基于两级分类（提示增强 / 工具调用 / 知识蒸馏 / Skillflow）自动归类
- **批量操作**：批量设置分类、批量设置标签、批量删除、绑定智能体（原"批量设置工具"更名）
- **UI 优化**：LLM Tab 重设计、搜索框折叠、图标尺寸优化

### Fixed
- 修复 Anthropic 认证：改用 `x-api-key` 头，移除错误的 `*x-api-key` 格式
- 修复 OpenAI 请求：`json_mode` 关闭时不再附加 `response_format`
- 修复 Tauri 2 错误对象格式解析
- 修复 `resolve_base_url` 根据 `api_format` 正确选择 URL

## [3.2.2] - 2026-06-26

### Added
- **Hermes profiles 检测**：支持自动识别多个 Hermes profile 目录
- **Provider UI 改进**：ProviderAddModal 拆分 base_url 为 OpenAI + Anthropic 两个输入
- **工具绑定备份/恢复**：支持格式兼容与备份还原

### Fixed
- StepFun Provider 配置：补充 `base_url_anthropic`，更新模型名
- `codex_config.rs` 中的 `json!` 宏语法错误
- Claude Code 模型配置 + Codex session token 保护
- Scope 徽章不再横向拉伸，位置调整到卡片底部

## [3.2.1] - 2026-06-23

### Added
- **模型市场（Model Marketplace）**：内置 20+ LLM Provider 目录，一键添加
- **智能图标匹配**：根据 Provider 名称（含中英文、拼音、别名）自动匹配图标
- **自定义 Provider**：支持自定义 Base URL / API Key / Model

### Changed
- Skills.tsx 大规模拆分：3,819 → 2,525 行（-34%），抽出 SkillCard、3 个 Dialog、3 个 Hook
- 加入 React.memo、搜索防抖（300ms）、路由懒加载

### Fixed
- Marketplace 按钮交互
- 侧边栏折叠状态在 Layout 与 MinimalLayout 间共享
- 批量翻译切换页面后结果不丢失、SSE 流僵死不再挂起
- Sortable 拖拽顺序保留

## [3.2.0] - 2026-06-23

### Added
- **Glassmorphism UI**：整体视觉升级，Provider 卡片改版 + Logo
- **翻译系统统一**：内存缓存 + 文件缓存双层，避免重复请求
- **Provider 目录**：内置常用 Provider 信息，`data/providerDirectory.json`

### Changed
- 侧边栏顺序调整为：智能体 / 技能库 / 大模型 / 市场 / 设置

## [3.1.1] - 2026-06-21

### Added
- **多 Provider 大模型页**：LlmModel 页面 + `pages/llm/*` 子路由
- **虚拟化 & 懒加载**：`@tanstack/react-virtual` 加持长列表；大组件路由懒加载

### Changed
- 代码质量整理，版本号 bump 到 3.1.1

## [3.0.0] - 2026-06-16

### Added
- **多语言显示**：技能名称与简介支持原始/中文/英文独立配置
- **一键翻译**：LLM 驱动的名称/简介翻译
- **自定义显示名**：不修改原始文件的展示层重命名
- **安全加固**：文件路径校验、CSP、URL 校验
- **配置缓存**：提升响应速度
- **作用域筛选**：技能列表支持全部/全局/项目筛选

### Changed
- UI 简约化优化（侧边栏、卡片、设置页）
- Skills.tsx 拆出 Dialog 与 Card 组件
- 侧边栏组件重构，抽出 SidebarNavButton
- 首个 Fork 后的开源版本，GitHub 链接迁移至 `ZLHAOOO/SkillX`

### Fixed
- panic! 崩溃、URL 校验漏洞、exit(0) 跳过析构、翻译错误处理重复代码、深链接静默忽略等

## [2.1.0] - 2026-06-14

### Changed
- 准备开源 Community Edition
- 移除云同步、遥测、投票、Vault 等 Pro 功能（后续持续清理）
- 保留 OAuth 认证（用于 GitHub Marketplace 集成）
- 添加功能标志系统

### Added
- 完整开源文档（LICENSE / CONTRIBUTING / SECURITY）
- 双语文档（中英）
- 隐私政策

## [2.0.3] - 2026-06-14 之前

### Added
- Skills 统一管理
- 软链接自动同步
- 内置 Monaco Editor
- AI 翻译支持
- Marketplace 浏览

## [2.0.0]

### Added
- 基于 Tauri 2.0 完整重写
- React 19 前端 + Rust 后端

[Unreleased]: https://github.com/ZLHAOOO/SkillX/compare/v3.4.0...HEAD
[3.4.0]: https://github.com/ZLHAOOO/SkillX/releases/tag/v3.4.0
[3.3.1]: https://github.com/ZLHAOOO/SkillX/releases/tag/v3.3.1
[3.2.2]: https://github.com/ZLHAOOO/SkillX/releases/tag/v3.2.2
[3.2.1]: https://github.com/ZLHAOOO/SkillX/releases/tag/v3.2.1
[3.2.0]: https://github.com/ZLHAOOO/SkillX/releases/tag/v3.2.0
[3.1.1]: https://github.com/ZLHAOOO/SkillX/releases/tag/v3.1.1
[3.0.0]: https://github.com/ZLHAOOO/SkillX/releases/tag/v3.0.0
[2.1.0]: https://github.com/ZLHAOOO/SkillX/releases/tag/v2.1.0
[2.0.3]: https://github.com/ZLHAOOO/SkillX/releases/tag/v2.0.3
[2.0.0]: https://github.com/ZLHAOOO/SkillX/releases/tag/v2.0.0
