# Local AI App

本地 AI 对话客户端 —— 多模型、多对话、灵活提示词配置。

## 核心特性

- 💬 **多轮对话** — 每对话独立配置模型和提示词
- 🎯 **两级提示词** — 全局提示词 + 对话级提示词，灵活叠加
- 🧠 **多模型** — DeepSeek / 豆包 / Kimi / GLM 自由切换
- ⚡ **流式输出** — 实时渲染 AI 回复
- 🔒 **本地优先** — 数据全在本地
- 🪶 **轻量** — Electron 桌面应用

## 默认模型

| 模型 ID | 说明 |
|---------|------|
| `deepseek-v4-flash` | 默认，快速响应 |
| `deepseek-v4-pro` | 增强版，复杂推理 |

其他支持的模型：豆包、Kimi、GLM。

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面壳 | Electron 43 |
| 前端 | React 18 + TypeScript + Tailwind CSS |
| IPC | Electron Context Bridge |
| 持久化 | JSON 文件存储 |

## 快速开始

```bash
# 开发模式（前端 + Electron）
npm run dev          # 启动 Vite 开发服务器
npm run electron:dev # 构建并启动 Electron（读取 dist/）

# 构建生产版本
npm run electron:build
```

## 项目结构

```
electron/        # Electron 主进程
  main.cjs       #   入口（IPC handler、窗口管理）
  preload.cjs    #   预加载脚本（暴露 API 到渲染进程）
src/             # React 前端
  components/    #   组件（Chat / Prompts / Settings）
  stores/        #   Zustand 状态管理
  types/         #   TypeScript 类型
dist/            # 构建输出
src-tauri/       # [备选] Tauri 后端代码（待编译环境可用）
docs/            # 产品文档
```

## 模型 API 配置

在设置页面中自行配置以下信息：

| 厂商 | 需要配置 |
|------|---------|
| DeepSeek | API Key + Base URL |
| 豆包 | API Key + Endpoint |
| Kimi | API Key + Base URL |
| GLM | API Key + Base URL |
