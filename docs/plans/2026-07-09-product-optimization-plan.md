# SkillX 产品优化方案

> 撰写日期：2026-07-09
> 版本基线：v3.4.0
> 视角：产品架构师 + 全栈工程师
> 原则：极简，非技术人员亦可理解

---

## 执行进度速览（2026-07-09 更新）

| 项                                                                                          | 状态    | 提交                                   |
| ------------------------------------------------------------------------------------------ | ----- | ------------------------------------ |
| 版本号统一（`config.rs` 3.3.1 → 3.4.0）                                                           | ✅ 已完成 | `6cdbc51`                            |
| 文档全量对齐实际状态（CLAUDE.md / AGENTS.md / CHANGELOG / README / PRIVACY / SECURITY / CONTRIBUTING） | ✅ 已完成 | `5d4c5ff`                            |
| 归档临时文档到 `docs/archive/`                                                                    | ✅ 已完成 | `5d4c5ff`                            |
| README 版本顺序修正 & Windows 状态明示                                                               | ✅ 已完成 | `5d4c5ff`                            |
| 删除 4 个 Skills.tsx backup 文件（约 15,276 行死代码）                                                 | ✅ 已完成 | `c3a9f96`                            |
| `.gitignore` 加入 backup 模式防复发                                                               | ✅ 已完成 | `c3a9f96`                            |
| 文件行数 ratchet（shell + GitHub Actions）                                                       | ✅ 已完成 | `c3a9f96`                            |
| **首次启动流程 4 步 → 0 步 + 横幅**（删 Welcome 5 文件、静默初始化、Skills 页导入横幅）                               | ✅ 已完成 | 本次                                   |
| 拆分 Skills.tsx / marketplace.rs                                                             | ⏳ 待办  | —                                    |
| 侧边栏 9 → 5 项、AI 翻译入口 4 → 2                                                                  | ⏳ 待办  | —                                    |
| Settings 补"重新扫描导入"入口                                                                       | ⏳ 延后  | Settings.tsx 已在 ratchet 基线，等拆分重构一并加入 |
| 商业化路径选 A（云同步付费）                                                                            | ⏳ 待决策 | —                                    |
| Windows 版本发布                                                                               | ⏳ 待办  | —                                    |

> 已完成的条目在下文对应位置以 **✅** 标注。

---

## 一句话诊断

**你做了一个"好用的工具"，但还不是"好卖的产品"。** 功能已足够丰富（甚至偏多），当前最大的敌人是**臃肿**：代码在膨胀、功能在堆叠、定位在模糊。下一步的关键不是"加"，是"减"。

---

## 一、产品角度：从工具到产品

### 现状识别
- 版本迭代非常快（v3.0 → v3.4，功能不断堆），但 README 里的"What's New"顺序错乱（3.0 → 3.3 → 3.2），说明产品叙事没有梳理清楚。
- **核心价值不清晰**：技能同步管理器？AI 翻译工具？模型管理平台？技能市场？—— 现在四件事都在做。
- README 声称"跨平台支持 macOS/Windows/Linux"，但实际**只发布了 macOS 版本**——这是产品可信度的第一大伤。

### 优化建议（按优先级）

| # | 动作 | 说明 |
|---|------|------|
| 1 | **锁定一句话定位** | 建议："一处编写，处处可用的 AI Skills 管理中心"。所有次要功能（翻译、模型市场）都是这句话的支撑，不再并列宣传。 |
| 2 | **兑现跨平台承诺** | 要么补上 Windows（Linux 可缓），要么改文案为"macOS 优先"。当前状态是最伤口碑的。 |
| 3 | **梳理功能地图** | 目前有 9 个页面，信息架构过重。建议合并为 **3 大区**：**技能库 · 工具与模型 · 市场**。 |
| 4 | **停止再加新功能，做一次"减法版本"** | 下一个版本号定为 v4.0，主题就是"精简"——不加功能，只砍冗余、修体验、提性能。 |

### 商业化方向（选一条深耕，不要多线）

| 路径 | 门槛 | 建议 |
|------|------|------|
| **A. 云同步 + 团队协作**（推荐） | 中 | 已有 cloud_sync 基础。个人免费本地用，付费提供跨设备同步、团队共享技能库。Notion / Raycast 经典路线。 |
| B. Skills 市场分成 | 高 | 已有 Marketplace 页。允许作者上架付费 Skill 包，平台抽成。需要先做大免费市场活跃度。 |
| C. 企业版（私有部署） | 高 | 面向公司统一管理内部提示词/技能资产，按席位收费。 |

**建议先走 A**，因为已有 auth 和 cloud_sync 模块，成本最低。

---

## 二、用户体验角度

### 明确的问题

1. **首次启动流程过长**：Welcome → 目录设置 → 工具检测 → 导入 Skills 四步，可合并为两步。**✅ 已优化为 0 步 + 横幅：应用启动直接进入 Skills 页；后端默认目录 `~/.skillx/skills` 自动生效；如扫到已装工具里的现有技能，顶部弹出可关闭横幅，提供「一键导入 / 稍后 / 不再提示」三档。删除了 `Welcome.tsx` 及 4 个 step 组件。**
2. **9 个侧边栏入口太多**，用户会晕。参考 Raycast/Linear：主导航 ≤ 5 项。
3. **AI 翻译能力入口过于分散**：卡片菜单 + 工具栏 + Editor banner + Marketplace 胶囊，**4 个入口**反而让用户找不到主入口。建议收敛到**卡片按钮 + 批量操作栏**两处。
4. **软链接失败提示**（尤其 Windows 需开发者模式）目前只是文字警告，应该做成**引导式对话框**——一步一步教用户开启。
5. **10 个主题**（Apple/Comic/Cyberpunk/Default/Neumorphism × 明暗）是亮点也是负担。建议默认展示 3 个"精选主题"，其余折叠。
6. **Skills.tsx 有 5 个 backup 文件在仓库里**（.backup / .backup2 / .backup3 / .original）——用户看不到，但让协作者困惑。**✅ 已删除并加入 `.gitignore`（`c3a9f96`）**

### 需要用户测试验证的点
- 从"打开应用"到"第一次成功启用一个 Skill 到某个工具"要用多少秒？目标：**60 秒内**。
- 一个非程序员能不能看懂"符号链接"？—— 建议 UI 上换成"共享"或"同步"。

---

## 三、技术角度：极简与代码优雅

### 硬数据（直接反映问题）

| 文件 | 行数 | 问题 |
|------|------|------|
| `src/pages/Skills.tsx` | **3,122** | 单文件 God Component，v3.2.1 曾拆到 2,525 行，现在又涨回来了——**拆分没形成机制** |
| `src-tauri/src/services/marketplace.rs` | **3,764** | 后端最大文件，一个服务承担太多职责 |
| `src/pages/Tools.tsx` | 1,841 | 过大 |
| `src/pages/Settings.tsx` | 1,501 | 什么都往里塞 |
| `src/pages/Marketplace.tsx` | 1,348 | 需拆分 |
| `src-tauri/src/services/config_manager.rs` | 1,118 | 配置逻辑过重 |
| `src-tauri/src/services/scanner.rs` | 1,051 | |
| `src-tauri/src/services/codex_proxy.rs` | 987 | |

**行业经验值**：单个 React 页面组件 > 500 行、单个 Rust 服务 > 800 行，就应强制拆分。目前项目里 **8 个文件超过 1000 行**。

### 具体优化建议

#### A. 立即可做（1 周内）
1. **删除仓库里的 4 个 Skills.tsx backup 文件**（`.backup / .backup2 / .backup3 / .original`）—— 版本历史用 git 就行。**✅ 已完成（`c3a9f96`）**
2. **删除 `.DS_Store`**（多处存在），并在 `.gitignore` 全局忽略。**✅ 已在 `.gitignore`（原有），仓库当前无 tracked `.DS_Store`**
3. **归档根目录的临时文档**：`TRANSLATION_OPTIMIZATION_COMPLETED.md`、`DOWNLOAD_STATS.md` 移到 `docs/archive/`，根目录只保留 README、LICENSE、CONTRIBUTING、SECURITY、CHANGELOG 五份。**✅ 已完成（`5d4c5ff`）**
4. **README 修顺序**：3.4 → 3.3 → 3.2 → 3.0，或只保留最近两个版本，其余移入 CHANGELOG。**✅ 已完成（`5d4c5ff`）**

#### B. 中期重构（1 个月内）
5. **拆分 Skills.tsx**：按"卡片列表 / 工具栏 / 批量操作 / 对话框调度"四块拆分，目标每块 < 400 行。
6. **拆分 marketplace.rs**：分成 `marketplace/api.rs` · `marketplace/cache.rs` · `marketplace/models.rs` · `marketplace/install.rs`。
7. **前端建立"文件行数上限"规则**：`.eslintrc` 加 `max-lines: 500`，超过 CI 报错，防止代码再次膨胀。**✅ 已完成（`c3a9f96`）——因项目未装 ESLint，改用 `scripts/check-file-size.sh` + `.github/workflows/quality.yml`，`.ts/.tsx ≤500`、`.rs ≤800`，现存超标文件用 `scripts/file-size-budgets.txt` 冻结基线，ratchet 单向下降。**
8. **国际化文件**（zh.ts / en.ts）巡检：检查是否有孤儿 key。

#### C. 文档补齐（并行做）
9. `docs/` 目前有设计文档，但**缺少**：**⚠️ 注：原本"设计文档"其实并不存在（历史遗留误述），本次已在文档大修（`5d4c5ff`）中一并清理。**
   - `ARCHITECTURE.md`（一页图讲清前后端如何协作）
   - `CONTRIBUTING.md` 已有但过简，需补"如何加一个新 AI 工具"的 how-to
   - `docs/user-guide/` 面向普通用户的图文教程
10. **API/命令清单**：Rust 端所有 Tauri commands（约 20+ 个）在 `docs/api.md` 里成表，前端类型和后端签名对齐一次。**✅ 部分完成（`5d4c5ff`）——CLAUDE.md 已按域列出 80+ 个命令；独立的 `docs/api.md` 仍待办。**

---

## 建议的下一版本（v4.0）路线图

**主题：Less is More**

| 阶段 | 目标 | 交付 |
|------|------|------|
| 第 1 步 | 清理仓库垃圾 | 删 backup / DS_Store，README 修正，Windows 版本状态明确 **✅ 已完成（`5d4c5ff` + `c3a9f96`）** |
| 第 2 步 | 拆分巨型文件 | Skills.tsx / marketplace.rs 拆分，设立 500 行上限规则 **🟡 上限规则已落地（`c3a9f96`），实际拆分待办** |
| 第 3 步 | 收敛导航与 AI 翻译入口 | 侧边栏 9 项 → 5 项，AI 翻译入口 4 → 2 |
| 第 4 步 | 定位聚焦 | 官网/README 一句话定位，商业化路径选 A（云同步付费） |
| 第 5 步 | 补 Windows | 兑现跨平台承诺 |

---

## 结语

SkillX **底子非常好**——Rust + Tauri + React 19 的选型专业、Skills 同步的核心创意扎实、UI 已经很现代。它现在缺的不是能力，而是**克制**。

> **一个产品的成熟度，不看它加了多少功能，看它敢删多少功能。**

建议把 v4.0 定义为"精简版本"，用一次减法赢回结构上的清爽，再谈商业化。
