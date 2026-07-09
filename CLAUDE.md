# SkillX 项目指南

> 面向 AI 编码助手 & 人类开发者的项目上手文档。
> 最后同步日期：2026-07-09（对齐 v3.4.0）

## 项目概述

SkillX 是一个基于 Tauri 2 的桌面应用，用于统一管理多个 AI 编码助手的 Skills。
通过**软链接**机制，让同一份 Skill 在多个工具（Claude Code / Codex / Gemini / Cursor / Cline 等 20+ 工具）中共享，做到"一处编写，处处可用"。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 7 |
| 桌面外壳 | Tauri 2 (Rust) |
| 样式 | Tailwind CSS 4 + Radix UI |
| 编辑器 | Monaco Editor |
| 路由 | React Router 7 |
| 国际化 | 自定义 i18n（中/英） |

## 核心功能模块

对应 `src/pages/` 下的页面：

| 页面 | 说明 |
|------|------|
| `Welcome.tsx` | 首次启动引导（欢迎 → 目录设置 → 工具检测 → 可选导入现有 Skills） |
| `Skills.tsx` | Skills 管理主页（扫描、搜索、启用/禁用、批量操作、AI 分类、AI 翻译） |
| `Tools.tsx` | 工具（Agents）管理，检测已安装 CLI、显示配置目录、支持自定义工具 |
| `Marketplace.tsx` | Skills 市场浏览与安装 |
| `LlmModel.tsx` + `pages/llm/*` | 大模型 Provider 管理、模型市场、工具绑定 |
| `ProjectBindingsDialog.tsx` | 项目级别的 Skill 绑定 |
| `Editor.tsx` | 内置 Monaco 编辑器，含文件树 |
| `Feedback.tsx` | 反馈提交 |
| `Settings.tsx` | 公共目录、编辑器、语言、主题、AI 翻译配置 |

## 项目结构

```
src/                    # 前端代码
├── pages/              # 页面组件
├── components/         # UI 组件（layout/skills/marketplace/welcome/ui/...）
├── hooks/              # 自定义 Hooks
├── contexts/           # React Context
├── services/           # 前端服务层（auth/feedback/updater）
├── constants/          # 常量
├── i18n/               # 国际化（zh.ts / en.ts）
├── themes/             # 主题（5 组明暗共 10 套）
├── types/              # TypeScript 类型
└── assets/             # 静态资源（工具图标、平台图标）

src-tauri/              # Rust 后端
├── src/
│   ├── commands/       # Tauri 命令入口
│   ├── services/       # 业务逻辑（scanner/linker/detector/translation/...）
│   └── models/         # 数据模型
```

## 后端命令清单

**权威来源**：`src-tauri/src/lib.rs` 的 `invoke_handler!` 宏。当前已注册 **80+ 个** Tauri 命令，按域分组如下（仅列代表命令，全量见源码）：

| 域 | 代表命令 |
|------|------|
| 配置 | `get_config` / `save_config` / `is_initialized` / `mark_initialized` |
| Skills | `list_skills` / `refresh_skills` / `enable_skill` / `disable_skill` / `create_skill` / `delete_skill` / `batch_set_skill_tools` |
| 工具（Agents） | `detect_tools` / `refresh_tools` / `set_tool_enabled` / `create_custom_tool` / `update_custom_tool` / `save_tools_order` |
| 同步 | `check_sync_status` / `fix_sync_issues` / `scan_existing_skills` / `import_skills_to_hub` |
| 编辑器 | `detect_available_editors` / `open_in_editor` / `read_directory_tree` / `read_file` / `write_file` |
| Marketplace | `fetch_marketplace_skills` / `install_marketplace_skill` / `search_marketplace` / `install_from_platform` |
| LLM Provider | `get_llm_providers` / `save_llm_provider_multi` / `test_llm_provider` / `apply_model_to_tool` / `apply_claude_provider` / `get_tool_bindings` |
| 翻译 | `translate_skill` / `translate_skills_batch` / `translate_text_content` / `clear_translation_cache` / `ai_classify_skills` |
| 反馈/更新 | `submit_feedback` / `check_update` / `download_and_install` / `check_cli_installed` / `install_cli_tool` |

> ⚠️ 前端调用命令时参数名统一用 **camelCase**，Tauri 会自动转成 Rust 端的 snake_case。

---

## 开发经验与踩坑记录

### 1. Tauri 2.0 相关

- API 迁移：`@tauri-apps/api/tauri` → `@tauri-apps/api/core`
- 对话框等插件需单独安装：`@tauri-apps/plugin-dialog`
- 权限从 `allowlist` 改为 `capabilities`
- **始终参考 Tauri 2.0 官方文档**，不要用 1.x 示例

### 2. Rust 命令参数命名

```rust
// Rust 端 snake_case
fn enable_skill(skill_id: String, tool_id: String)
```
```typescript
// 前端必须用 camelCase 调用
invoke("enable_skill", { skillId, toolId })   // ✓
invoke("enable_skill", { skill_id, tool_id }) // ✗
```

### 3. Monaco Editor

- 用 `@monaco-editor/react` 简化集成
- 通过 `theme="vs-dark" | "light"` 同步主题

### 4. 跨平台路径

- Rust 端统一用 `std::path::PathBuf`
- 前端展示时把 `\` 转成 `/`

### 5. 软链接权限

- macOS/Linux 一般无需特殊权限
- **Windows 需开发者模式或以管理员运行**，创建失败时给用户明确提示

### 6. React 状态更新

- 用 `useCallback` 包装数据获取函数
- 操作完成后重新拉取最新数据，而不是手动同步 state

### 7. 样式规范

- 优先使用 Tailwind 类
- 动态样式（hover 等）可用内联样式 + 事件处理
- 避免大面积 `style={{}}`

### 8. 类型安全

- 前端类型集中在 `src/types/index.ts`
- 确保与 Rust `models/` 中的结构体对齐

### 9. 国际化

- 用户可见文案必须走 `t("key")`
- 文案定义在 `src/i18n/locales/{zh,en}.ts`

### 10. 配置存放

- 全局配置：`~/.skillx/config.json`
- 翻译缓存：`~/.skillx/cache/translations/<sha256>.json`
- 与任一 AI 工具的配置解耦，便于备份和迁移

---

## 11. CI 打包与测试文件隔离（重要）

**症状**：`npm run tauri build` 时 `tsc && vite build` 报 `TS2307: Cannot find module 'node:test'`。

**根因**：`tsconfig.json` 的 `include: ["src"]` 会把 `src/**/*.test.ts` 一并纳入类型检查，而这些测试文件使用 Node 内置 `node:test` 模块，前端构建环境不保证有对应类型声明。

**已修**：`tsconfig.json` 增加
```json
"exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]
```

**防复发**：
1. 前端生产构建的 tsconfig 永远不要包含 `*.test.ts(x)`
2. 本地干净验证：`npx tsc --noEmit --typeRoots ./node_modules/@types`

---

## 12. 版本升级操作

升级版本号需同步修改以下 **4 处**：

1. `package.json` → `version`
2. `src-tauri/tauri.conf.json` → `version`
3. `src-tauri/Cargo.toml` → `version`
4. `src-tauri/src/models/config.rs` → `AppConfig::default()` 中的 `version`

（用户配置 `~/.skillx/config.json` 会在启动时自动迁移，无需手动改。）

**校验**：改完执行 `grep -R "版本号" .` 或直接看四个文件是否一致。

---

## 13. AI 翻译功能

**配置**：设置 → AI 翻译

- Base URL：OpenAI 兼容协议（OpenAI / DeepSeek / Qwen / Ollama 等）
- API Key：明文存 `~/.skillx/config.json`
- Model：如 `gpt-4o-mini` / `deepseek-chat` / `qwen-plus`

**触发**（完全手动）：
- Skills 卡片菜单：翻译 / 显示原文
- Skills 工具栏：批量翻译（AI 技能管家入口）
- Editor 打开 SKILL.md 时顶部 banner
- Marketplace 卡片标题旁的胶囊按钮

**实现要点**：
- 翻译结果**仅在 UI 显示，不写回磁盘**
- 缓存 key = base_url + model + target_lang + 源文本 sha256
- 内存态 + 文件缓存双层；进行中的 promise 复用避免连点

---

## 常用命令

```bash
# 开发
npm run tauri dev

# 生产构建
npm run tauri build

# 前端构建（含类型检查）
npm run build

# Rust 单元测试
cd src-tauri && cargo test

# 前端单元测试（.test.ts 文件用 node:test 运行）
node --import tsx --test src/**/*.test.ts   # 需先装 tsx

# 文件行数上限检查（本地也可跑，CI 上是必过项）
bash scripts/check-file-size.sh
```

> ⚠️ 当前 `package.json` 未提供 `typecheck` / `lint` / `test` 脚本，如需可自行添加或直接调 `tsc` / `eslint`。

### 文件行数预算（ratchet）

`.github/workflows/quality.yml` 会在每次 push / PR 时运行 `scripts/check-file-size.sh`：

- 默认阈值：`.ts` / `.tsx` ≤ 500 行，`.rs` ≤ 800 行。
- 目前已超阈值的文件在 `scripts/file-size-budgets.txt` 中被"冻结"在当前行数。
- 规则：**只能减、不能增**。重构变小 → 手动降低预算；降到默认阈值以下 → 删掉该行。
- 新文件必须落在默认阈值内，否则 PR 失败。这样技术债只会单调下降。

---

## Git 操作约定

- 永远不要 force push 到 `main` / `master`
- 预提交钩子失败后：**修复问题并新建 commit**，不要 `--amend`
- 分支命名：`feat/` `fix/` `docs/` `refactor/` `test/` `chore/`
- 提交信息遵循 Conventional Commits（`feat:` / `fix:` / `docs:` / …）
