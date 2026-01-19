# Foundry Chat

一款基于 Electron 的 AI 聊天桌面应用，支持本地模型和云端 API。

> 本项目基于 [microsoft/Foundry-Local](https://github.com/microsoft/Foundry-Local/tree/main/samples/electron/foundry-chat) 的 Electron 示例修改而来，增加了更多实用功能。

## ✨ 功能特性

- 🖥️ **双模式支持**：同时支持 Foundry 本地模型和 OpenAI 格式的云端 API
- ⚙️ **云端 API 配置**：可视化配置 API 地址、密钥和模型名称，支持深度求索、通义千问等
- 💬 **历史记录**：侧边栏显示对话历史，支持保存、加载、删除
- ⏹️ **中断输出**：随时停止 AI 生成
- 💡 **思考折叠**：自动折叠 AI 的思考过程（支持 `<think>` 标签）
- 🎨 **现代 UI**：深色主题，中文界面，流畅动画
- 📝 **中文优化**：平滑的中文字体渲染

## 📸 截图

![应用截图](screenshot.png)

## 🚀 快速开始

### 环境要求

- Node.js 16+
- [Foundry Local](https://www.foundrylocal.ai/) 服务运行中（使用本地模型时）

### 安装与运行

```bash
# 安装依赖
npm install

# 启动应用
npm start
```

### 打包

```bash
# Windows 打包
npm run build:win

# 输出目录：dist/
```

## ⚙️ 云端 API 配置

点击应用内的「设置」按钮，可配置：

| 字段 | 说明 | 示例 |
|------|------|------|
| API 地址 | OpenAI 格式的 API Endpoint | `https://api.deepseek.com/v1` |
| API Key | 你的 API 密钥 | `sk-xxx` |
| 模型名称 | 要使用的模型 | `deepseek-chat` |

支持所有兼容 OpenAI 格式的 API 服务商。

## 📁 项目结构

```
foundry-chat/
├── main.js        # Electron 主进程
├── preload.cjs    # 预加载脚本（IPC 桥接）
├── chat.html      # 渲染进程（UI + 逻辑）
├── package.json   # 项目配置
└── .gitignore     # Git 忽略配置
```

## 🔧 技术栈

- **框架**：Electron 28
- **AI SDK**：foundry-local-sdk、OpenAI Node.js SDK
- **打包**：electron-builder
- **UI**：原生 HTML/CSS/JavaScript

## 📄 许可证

MIT License

## ⚠️ 声明

本项目基于 [microsoft/Foundry-Local](https://github.com/microsoft/Foundry-Local/tree/main/samples/electron/foundry-chat) 的示例代码修改而来。

- 本项目**不包含** Foundry Local 软件本身，仅为一个使用其 SDK 的客户端应用
- 使用本项目需要自行安装 [Foundry Local](https://github.com/microsoft/Foundry-Local) 服务
- `foundry-local-sdk` 通过 npm 依赖获取，请遵守其原始许可证

## 🙏 致谢

- [microsoft/Foundry-Local](https://github.com/microsoft/Foundry-Local) - 原始项目
