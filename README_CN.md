# SkillX

<p align="center">
  <img src="./assets/logo.png" alt="SkillX Logo" width="128" />
</p>

> **一款统一的 AI 编码助手技能管理桌面应用。**
> 无缝管理、同步和分享 **Claude Code、Codex、Opencode** 等 AI 工具的技能。

![Version](https://img.shields.io/badge/version-3.0.0-blue) ![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey) ![Tech](https://img.shields.io/badge/built%20with-Tauri%202.0%20%2B%20React%2019-orange)

[English](./README.md)

## 📖 简介

**SkillX** 是一款现代化桌面应用，旨在解决 AI 助手技能配置碎片化的问题。不再需要为不同工具分别管理技能，SkillX 提供了一个中心化的管理平台。

通过强大的 **软链接同步机制**，您只需编写一次技能，即可在 Claude Code、Codex、Opencode 等支持的 AI 工具中即时使用。

## ✨ 核心特性

- **🎯 统一管理**：将所有 AI 技能集中在一个安全的位置。
- **🔄 智能同步**：自动软链接管理，确保您的工具始终拥有最新版本的技能，无需文件复制。
- **🎛️ 精细控制**：可以为特定工具单独启用或禁用技能，而不删除原始文件。
- **🌐 多语言显示**：自定义技能名称和简介的显示语言（原始/中文/英文），支持一键 AI 翻译。
- **⚡ 高性能**：基于 **Rust** 和 **Tauri 2.0** 构建，轻量且极速，支持配置缓存。
- **🛡️ 跨平台**：原生支持 macOS、Windows 和 Linux。
- **🔌 多工具支持**：开箱即用支持 **Claude Code、Codex、Opencode**，可扩展支持更多工具。
- **🧩 自定义工具**：可添加带有自定义路径和可选图标的专属工具。
- **🎨 现代界面**：基于 React 19、Tailwind CSS v4 和 Radix UI 构建的简约美观界面。

## 📥 下载

从 **[发布页面](../../releases)** 下载最新版本的安装包。

| 操作系统 | 安装包类型 |
|----------|------------|
| **macOS** | `.dmg` (Universal) |
| **Windows** | `.msi` / `.exe` |
| **Linux** | `.deb` / `.AppImage` / `.rpm`|

## ⚠️ Windows 注意事项

如果在同步技能时遇到权限问题（符号链接创建错误）或检测问题，请以 **管理员身份** 运行应用。在 Windows 上，除非启用了开发者模式，否则创建符号链接通常需要管理员权限。

## 🚀 快速开始

1. **安装**：运行对应平台的安装包。
2. **设置**：首次启动时，应用会引导您选择技能存储目录。
3. **同步**：应用自动检测已安装的 AI 工具（如 Claude Code）并链接您的技能。

## ❗ Linux 故障排除

如果在 Linux 上启动 `.AppImage` 时遇到**白屏**（尤其是在 VMware/VirtualBox 等虚拟机中），可能是 WebKitGTK 硬件加速问题。

请在终端中使用以下命令运行：

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 ./SkillX_1.0.1_amd64.AppImage
```

## 🛠️ 技术栈

- **核心**: [Tauri 2.0](https://tauri.app/) (Rust)
- **前端**: [React 19](https://react.dev/) + TypeScript
- **样式**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI 组件**: [Radix UI](https://www.radix-ui.com/)
- **编辑器**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)

## 📅 v3.0.0 更新内容

- **🌐 多语言显示**：自定义技能名称和简介的显示语言（原始/中文/英文）
- **🤖 一键翻译**：使用 LLM 自动翻译技能名称和简介
- **✏️ 自定义显示名称**：编辑技能在列表中的显示方式，不修改原始文件
- **🔒 安全加固**：文件路径验证、CSP 策略、URL 校验
- **⚡ 性能优化**：配置缓存机制，提升响应速度
- **🎨 UI 优化**：简约化设计，改进侧边栏、卡片和设置页面

## 🙏 致谢

SkillX 是 **[Skills Manager](https://github.com/jiweiyeah/Skills-Manager)** 的 fork 项目，由 [jiweiyeah](https://github.com/jiweiyeah) 原创开发。我们衷心感谢原作者及所有贡献者打下的坚实基础，没有他们的出色工作，就不会有这个项目。

- 原始项目：[jiweiyeah/Skills-Manager](https://github.com/jiweiyeah/Skills-Manager)
- 原作者：[jiweiyeah](https://github.com/jiweiyeah)

## 🤝 贡献与反馈

我们欢迎各种形式的贡献！

- **发现 Bug？** 请在 [Issues](../../issues) 页面提交问题。
- **有功能建议？** 欢迎开启 Issue 讨论新功能。

## 📈 Star 历史

[![Star History Chart](https://api.star-history.com/svg?repos=ZLHAOOO/SkillX&type=Date)](https://star-history.com/#ZLHAOOO/SkillX&Date)

---

*为 AI 开发者社区用心打造 ❤️*
