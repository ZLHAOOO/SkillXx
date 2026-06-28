# SkillX

<p align="center">
  <img src="./assets/logo.png" alt="SkillX Logo" width="128" />
</p>

> **A unified desktop application for managing AI coding assistant skills.**
> Seamlessly organize, sync, and share skills for **Claude Code, Codex, Opencode** and other AI tools.

![Version](https://img.shields.io/badge/version-3.3.0-blue) ![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey) ![Tech](https://img.shields.io/badge/built%20with-Tauri%202.0%20%2B%20React%2019-orange)

[中文说明](./README_CN.md)

## 📖 Introduction

**SkillX** is a modern desktop application designed to solve the fragmentation of AI assistant skills configurations. Instead of managing skills and prompts separately for different tools, SkillX provides a central hub.

It uses a powerful **symlink synchronization mechanism**, allowing you to write a skill once and instantly use it across supported AI tools like Claude Code, Codex, Opencode.

## ✨ Key Features

- **🎯 Unified Management**: Centralize all your AI skills in one secure location.
- **🔄 Smart Synchronization**: Automatic symlink management ensures your tools always have the latest version of your skills without file duplication.
- **🎛️ Granular Control**: Enable or disable specific skills for individual tools without deleting the original files.
- **🌐 Multi-Language Display**: Customize skill names and descriptions in different languages (Original/Chinese/English) with one-click AI translation.
- **⚡ High Performance**: Built with **Rust** and **Tauri 2.0** for a lightweight, blazing-fast experience with config caching.
- **🛡️ Cross-Platform**: Native support for macOS, Windows, and Linux.
- **🔌 Multi-Tool Support**: Out-of-the-box support for **Claude Code, Codex, Opencode** and extensible to others.
- **🧩 Custom Tools**: Add your own tools with custom paths and optional icons.
- **🎨 Modern UI**: Beautiful, minimalist interface built with React 19, Tailwind CSS v4, and Radix UI.

## 📥 Download

Download the latest installer for your operating system from the **[Releases Page](../../releases)**.

| OS | Installer Type |
|----|----------------|
| **macOS** | `.dmg` (Universal) |
| **Windows** | `.msi` / `.exe` |
| **Linux** | `.deb` / `.AppImage` / `.rpm`|

## ⚠️ Windows Important Note

If you encounter permission issues when syncing skills (symbolic link creation errors) or detection issues, please try running the application as **Administrator**. This is often required on Windows to create symbolic links unless Developer Mode is enabled.

## 🚀 Getting Started

1. **Install**: Run the installer for your platform.
2. **Setup**: On first launch, the app will guide you to select your skills storage directory.
3. **Sync**: The app automatically detects installed AI tools (like Claude Code) and links your skills.

## ❗ Linux Troubleshooting

If you encounter a **blank white screen** when launching the `.AppImage` on Linux (especially in virtual machines like VMware/VirtualBox), it is likely a WebKitGTK hardware acceleration issue.

Please run the application from the terminal with the following command:

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 ./SkillX_1.0.1_amd64.AppImage
```

## 🛠️ Technology Stack

Designed for developers who care about performance and stability:

- **Core**: [Tauri 2.0](https://tauri.app/) (Rust)
- **Frontend**: [React 19](https://react.dev/) + TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/)
- **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)

## 📅 What's New in v3.0.0

- **🌐 Multi-Language Display**: Customize skill names and descriptions in different languages (Original/Chinese/English)
- **🤖 One-Click Translation**: AI-powered translation for skill names and descriptions using LLM
- **✏️ Custom Display Names**: Edit how skills appear in the list without modifying original files
- **🔒 Security Enhancements**: File path validation, CSP policy, and URL verification
- **⚡ Performance Improvements**: Config caching for faster response times
- **🎨 UI Optimization**: Minimalist design with improved sidebar, cards, and settings page

## 🙏 Acknowledgments

SkillX is a fork of **[Skills Manager](https://github.com/jiweiyeah/Skills-Manager)** by [jiweiyeah](https://github.com/jiweiyeah). We are deeply grateful to the original author and all contributors for building such a solid foundation. This project would not exist without their excellent work.

- Original project: [jiweiyeah/Skills-Manager](https://github.com/jiweiyeah/Skills-Manager)
- Original author: [jiweiyeah](https://github.com/jiweiyeah)

## 🤝 Contributing & Feedback

We welcome all forms of contribution!

- **Found a bug?** Please submit an issue on our [Issues](../../issues) page.
- **Have a feature request?** We'd love to hear your ideas! Feel free to open an issue to discuss new features.

## 🆕 What's New in v3.3.0

### AI 技能管家 (AI Assistant)
- **AI 技能管家入口**: 工具栏新增 AI 技能管家按钮（图标样式，悬停显示文字），整合 AI 批量翻译与 AI 分类管理两大功能
- **AI 批量翻译**: 调用 LLM 批量翻译技能名称和描述，支持进度显示和错误重试
- **AI 分类管理**: 基于两级分类体系，使用 AI 自动为技能归类（一级分类 4 选 1，二级分类支持多选）
- **分类体系**: 提示增强 / 工具调用 / 知识蒸馏 / Skillflow 四大类，支持二级维度自定义

### 批量管理增强
- **批量设置分类**: 多选技能后一键设置一级+二级分类
- **批量设置标签**: 多选技能后批量追加或覆盖标签
- **批量删除**: 多选技能/技能组后一键删除
- **绑定智能体**: 原"批量设置工具"更名为"绑定智能体"

### UI 优化
- **LLM 页面 Tab 重设计**: 图标 + 文字风格，全宽分割线，与技能库页面视觉统一
- **搜索框折叠**: 点击搜索框外区域自动折叠为图标
- **图标尺寸优化**: 搜索图标和 AI 技能管家图标放大，视觉更清晰

---

## 🆕 What's New in v3.2.1

### Model Marketplace
- **20+ LLM Providers**: Browse and add providers with one click — OpenAI, Anthropic, DeepSeek, Qwen, Kimi, Gemini, GLM, Xiaomi, Volcengine, Stepfun, Mistral, Grok, MiniMax, and more
- **Smart Icon Matching**: Automatically matches provider icons by name (supports Chinese, English, pinyin, and aliases)
- **Custom Provider**: Add your own LLM provider with custom Base URL, API Key, and model
- **Grid Layout**: Provider cards in responsive grid with search and filter

### Architecture Refactoring
- **Skills.tsx split**: 3,819 → 2,525 lines (-34%), extracted SkillCard, 3 dialog components, and 3 custom hooks
- **Component structure**: Each component now has a single responsibility — easier to maintain and test
- **Backend improvements**: Enhanced config, LLM, and marketplace modules

### Performance
- **React.memo**: Expensive components only re-render when data changes
- **Search debounce**: 300ms delay prevents excessive filtering on fast typing
- **Route lazy loading**: Components load on demand, faster startup

### UI Polish
- **Inter font**: Clean, modern typography
- **Consistent border-radius**: Unified 12→14→16→20px scale across all components
- **Sidebar**: Pill-shaped nav items, dark background (#161616)
- **Feedback form**: Built into Settings page with GitHub issue link and contact form

### Code Quality
- **0 TypeScript errors**: All type issues resolved
- **0 Rust warnings**: Clean cargo check
- **Dead code cleanup**: Removed unused imports, variables, and the reverted virtualizer

### Bug Fixes
- GitHub links updated to new repository (SkillXx)
- Settings feedback form points to correct repo
- Drag region fix for macOS titlebar

---

## 📈 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ZLHAOOO/SkillX&type=Date)](https://star-history.com/#ZLHAOOO/SkillX&Date)

---

*Made with ❤️ for the AI developer community.*
