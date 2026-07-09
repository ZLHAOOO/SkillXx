# 安全政策 · Security Policy

## 报告安全漏洞 · Reporting a Vulnerability

如果你发现了安全漏洞，**请不要在公开 Issue 中提交**。

**推荐方式** —— 使用 GitHub 私有安全公告：

1. 打开仓库首页
2. 点击 **Security** → **Report a vulnerability**
3. 填写漏洞信息（描述、重现步骤、影响范围、可能的修复思路）

或者，在 [Issues](../../issues) 中创建一个**不含漏洞细节**的占位 Issue，标题注明 "Security disclosure request"，维护者会通过其他渠道与你联系。

> 💡 请一次性提供：**描述 / 重现步骤 / 影响范围 / 复现环境（OS、SkillX 版本）**，便于快速定位。

我们会在 **72 小时内**回复，并根据严重程度尽快发布修复。

---

## 支持的版本 · Supported Versions

| 版本 | 支持状态 |
|------|---------|
| 3.4.x | ✅ 完全支持 |
| 3.3.x | ✅ 完全支持 |
| 3.2.x | ⚠️ 仅安全修复 |
| < 3.2 | ❌ 不再支持，请升级 |

---

## 安全最佳实践 · Best Practices

使用 SkillX 时建议：

- ✅ 只从 [GitHub Releases](../../releases) 官方源下载安装包
- ✅ 定期更新到最新版本
- ✅ **不要将 `~/.skillx/config.json` 分享或上传**（可能包含 LLM Provider 的 API Key）
- ✅ 使用不同 Provider 的独立 API Key，便于按需吊销

---

## 致谢 · Credits

感谢负责任地披露漏洞的所有安全研究人员。有效报告的贡献者将（在获得同意后）列于此处。
