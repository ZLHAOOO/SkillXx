# SkillX

<p align="center">
  <img src="./assets/logo.png" alt="SkillX Logo" width="128" />
</p>

> **A unified desktop app for managing AI coding assistant skills.**
> Write a skill once, use it across **Claude Code, Codex, Gemini, Cursor, Cline** and 20+ AI tools.

![Version](https://img.shields.io/badge/version-3.5.3-blue) ![Platform](https://img.shields.io/badge/platform-macOS-lightgrey) ![Tech](https://img.shields.io/badge/built%20with-Tauri%202.0%20%2B%20React%2019-orange)

[中文说明](./README_CN.md) · [Changelog](./CHANGELOG.md)

## 📖 Introduction

**SkillX** is a modern desktop app that solves the fragmentation of AI assistant skills. Instead of managing skills separately for each tool, SkillX centralizes them and syncs them via **symbolic links** — so a skill you write once shows up everywhere it's needed.

## ✨ Key Features

- **🎯 Unified Management** — All AI skills in one place.
- **🔄 Symlink Sync** — Automatic, no file duplication, always up-to-date.
- **🎛️ Granular Control** — Enable or disable specific skills per tool without deleting files.
- **🌐 Multi-Language Display** — Show skill names/descriptions in original/Chinese/English with one-click AI translation.
- **🏪 Model Marketplace** — Browse and add 20+ built-in LLM providers (OpenAI, Anthropic, DeepSeek, Qwen, Kimi, GLM, Gemini, Grok, MiniMax, and more).
- **🔗 Tool Binding** — Bind an LLM provider to a specific tool and switch models with one click.
- **⚡ High Performance** — Built with Rust + Tauri 2.0; config caching for fast responses.
- **🔌 Multi-Tool Support** — Claude Code, Codex, Gemini, Cursor, Cline, Kiro, Trae, Iflow, Qwen Code, Hermes, Opencode, and more — plus custom tools with your own paths.
- **🎨 Modern UI** — React 19 + Tailwind CSS v4 + Radix UI; 10 built-in themes (5 styles × light/dark).

## 📸 Screenshots

### 🛠️ Tool Management — detect every AI agent on your machine

Detects installed AI coding tools and shows their config + skills paths. Built-in agents are detected by directory; custom tools can be added with any path. The Tools page also auto-links default skills to a freshly-enabled tool.

<p align="center">
  <img src="./assets/preview-tools.png" alt="Tool management showing Claude Code, Codex, OpenCode, OpenClaw, Qoder, Pi, Trae CN, QClaw" width="800" />
</p>

### 📚 Skills Library — central hub for every skill

All skills live in a single hub directory and are synced to each enabled tool via symlinks. Each card shows which tools a skill is currently enabled for, with a single click to toggle or jump to the editor.

<p align="center">
  <img src="./assets/preview-skills.png" alt="Skills library with 519 skills, category filters, and per-tool enable indicators" width="800" />
</p>

### 🤖 Model Marketplace — 20+ LLM providers ready to use

Manage multiple LLM providers side by side (OpenAI, Anthropic, DeepSeek, Qwen, Kimi, GLM, Gemini, Grok, MiniMax, Volcano Engine, StepFun, and more), pick an active one, and bind it to a specific tool. Custom providers are supported with any OpenAI-compatible endpoint.

<p align="center">
  <img src="./assets/preview-models.png" alt="Model marketplace showing LongCat, Agnes, Step, MiMo, Ark and a list of provider tabs" width="800" />
</p>

### 🏪 Skill Marketplace — discover and install new skills

Browse curated sources (`skills.sh`, `awesome-claude-skills`, `ClawHub`, `SkillHub`, `Red Skill`) and one-click install. Filters and search help you find what you need across thousands of community skills.

<p align="center">
  <img src="./assets/preview-marketplace.png" alt="Marketplace with source selector and skill cards" width="800" />
</p>

## 📥 Download

Get the latest installer from the **[Releases page](../../releases)**.

| OS | Installer | Status |
|----|-----------|--------|
| **macOS** (Apple Silicon) | `.dmg` (aarch64) | ✅ Available |
| **Windows** | `.msi` / `.exe` | 🔜 Coming soon |
| **Linux** | `.deb` / `.AppImage` / `.rpm` | 🔜 Coming soon |

> 🪟 **Windows & Linux**: v3.4.0 currently ships macOS only. Windows and Linux installers are planned for a future release.

## 🚀 Getting Started

1. **Install** the macOS installer.
2. **Setup** — On first launch, the app guides you through picking a skills storage directory.
3. **Sync** — SkillX detects installed AI tools automatically and links your skills.

## 🛠️ Technology Stack

- **Core**: [Tauri 2.0](https://tauri.app/) (Rust)
- **Frontend**: [React 19](https://react.dev/) + TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI**: [Radix UI](https://www.radix-ui.com/)
- **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)

## 📅 What's New

### v3.4.0 (2026-07-03)
- **Theme System** — 5 style families × light/dark = 10 themes (Apple / Comic / Cyberpunk / Default / Neumorphism)
- **Tool Binding** — Bind an LLM provider to a specific tool and switch models with one click
- **Multi-Provider Management** — Manage multiple LLM providers side by side, mark one as active

### v3.3.1 (2026-07-01)
- **AI Skill Butler** — Unified entry combining AI batch translation and AI classification
- **Batch Ops** — Category, tag, delete, and agent binding across many skills at once
- **Stability** — Anthropic auth header fix, OpenAI `response_format` fix, Tauri 2 error object parsing

### v3.2.x (2026-06-23 ~ 06-26)
- **Model Marketplace** — 20+ built-in LLM providers, smart icon matching, custom providers
- **Hermes profiles detection**, glassmorphism UI, unified translation caching
- Skills.tsx refactor: 3,819 → 2,525 lines (-34%)

### v3.0.0 (2026-06-16)
- Multi-language display + one-click AI translation
- Security hardening (path validation, CSP, URL checks)
- Config caching, first open-source community release

> Full history: **[CHANGELOG.md](./CHANGELOG.md)**

## 🙏 Acknowledgments

SkillX is a fork of **[Skills Manager](https://github.com/jiweiyeah/Skills-Manager)** by [jiweiyeah](https://github.com/jiweiyeah). We're deeply grateful to the original author and all contributors for the solid foundation this project stands on.

## 🤝 Contributing & Feedback

- **Bug report** — open an issue on the [Issues](../../issues) page.
- **Feature request** — start a discussion in [Issues](../../issues).
- **Contribution guide** — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## 📈 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ZLHAOOO/SkillX&type=Date)](https://star-history.com/#ZLHAOOO/SkillX&Date)

---

*Made with ❤️ for the AI developer community.*
