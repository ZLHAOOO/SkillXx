# SkillX

> **A unified desktop application for managing AI coding assistant skills.**
> Seamlessly organize, sync, and share skills for **Claude Code, Codex, Opencode** and other AI tools.

![Version](https://img.shields.io/badge/version-3.0.0-blue) ![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey) ![Tech](https://img.shields.io/badge/built%20with-Tauri%202.0%20%2B%20React%2019-orange)

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

## 🗺️ Roadmap

We are actively working on making SkillX better. Here is what we are planning:

- [x] Core features (e.g., soft link synchronization, multi-tool support).
- [x] Multi-language display and one-click translation.
- [ ] Community Hub – Share and download community-contributed Skills, etc.
- [ ] Cloud synchronization, allowing one-click migration of existing Skills and more when changing devices.
- [ ] Plugin system to support more AI tool extensions.
- [ ] Integrated AI chat interface for testing Skills directly within the application.

## 🙏 Acknowledgments

SkillX is a fork of **[Skills Manager](https://github.com/jiweiyeah/Skills-Manager)** by [jiweiyeah](https://github.com/jiweiyeah). We are deeply grateful to the original author and all contributors for building such a solid foundation. This project would not exist without their excellent work.

- Original project: [jiweiyeah/Skills-Manager](https://github.com/jiweiyeah/Skills-Manager)
- Original author: [jiweiyeah](https://github.com/jiweiyeah)

## 🤝 Contributing & Feedback

We welcome all forms of contribution!

- **Found a bug?** Please submit an issue on our [Issues](../../issues) page.
- **Have a feature request?** We'd love to hear your ideas! Feel free to open an issue to discuss new features.

## 📈 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ZLHAOOO/SkillX&type=Date)](https://star-history.com/#ZLHAOOO/SkillX&Date)

---

*Made with ❤️ for the AI developer community.*
