# Codex AI — 智能编程助手 · 开发设计文档（精细化版）

> **版本**: v1.1  
> **日期**: 2026-07-14  
> **状态**: Draft → Review Ready  

---

## 目录

1. [项目定位与核心功能](#1-项目定位与核心功能)
2. [技术选型（精确到包名版本）](#2-技术选型精确到包名版本)
3. [系统架构](#3-系统架构)
4. [数据模型设计](#4-数据模型设计)
5. [详细 API 设计](#5-详细-api-设计)
6. [核心模块实现](#6-核心模块实现)
7. [配置与环境管理](#7-配置与环境管理)
8. [错误处理体系](#8-错误处理体系)
9. [测试策略](#9-测试策略)
10. [CI/CD 流水线](#10-cicd-流水线)
11. [性能基线](#11-性能基线)

---

## 1. 项目定位与核心功能

### 1.1 一句话定位

> **A terminal-native AI coding agent** — 在终端里跑，能理解整个项目的结构和语义，自主完成代码生成、重构、调试、部署等开发任务。类似 Claude Code，但模型中立、可扩展。

### 1.2 核心功能清单（按交付版本严格划分）

#### 🟢 Phase 0：技术验证（2 周，约 500 行核心代码）

目标：验证 Agent Loop 能否真实工作——用户描述任务，AI 自主读写文件、执行命令，完成一次完整的开发操作。

| 编号 | 功能 | 说明 | 交付标准 |
|------|------|------|---------|
| C-01 | **Agent Loop (ReAct)** | while 循环：LLM 推理 → 工具调用 → 工具结果 → 继续推理 | 能够完成一个 3 步任务（读文件 → 分析 → 写新文件） |
| C-02 | **read_file** | 读取文件内容，支持行号、偏移量、截断显示 | ≤ 1MB 文件 < 200ms |
| C-03 | **write_file** | 创建新文件或覆盖写入 | 路径校验 + 内容写入 |
| C-04 | **edit_file** | 精确字符串替换编辑（old_string → new_string） | 非唯一匹配报错 |
| C-05 | **bash** | 执行 Shell 命令，流式输出 | 超时控制 120s + 黑名单 |
| C-06 | **glob** | 文件名模式搜索 | 支持 `**/*.ts` 等模式 |
| C-07 | **grep** | 正则内容搜索 | 支持 `-i` `-C` `-A` `-B` |
| C-08 | **list_dir** | 列出目录内容 | 支持递归 |
| C-09 | **CLI REPL** | 交互式命令行界面 | Ink 渲染，命令输入/输出循环 |
| C-10 | **CLI 一次命令** | `codex -p "任务"` 非交互模式 | 执行后自动退出 |
| C-11 | **最小权限确认** | 写操作和命令执行前暂停询问 | 用户输入 y/n |

**Phase 0 结束后，Codex 可以做到：**
> 用户输入 `codex -p "读取 README.md 然后总结给我"` → Agent 调用 read_file → LLM 分析内容 → 输出总结

#### 🟡 Phase 1：可用版本（4 周）

| 编号 | 功能 | 说明 |
|------|------|------|
| C-12 | **系统提示词系统** | 分片式 System Prompt（角色定义 + 项目配置 + 工具定义） |
| C-13 | **CODEX.md 项目配置** | 每个项目可配置编码规范、常用命令、忽略规则 |
| C-14 | **双模型支持** | 支持 DeepSeek + Claude 切换（通过环境变量配置） |
| C-15 | **操作审计日志** | 所有工具调用记录到 `~/.codex/audit/` |
| C-16 | **Checkpoint (内存版)** | 每次工具调用后保存状态快照，支持 /rewind |
| C-17 | **权限分层** | 只读自动、写入确认、命令确认、高危标记 |
| C-18 | **命令黑名单** | 硬编码黑名单：`rm -rf /`, `dd if=`, `:(){:\|:&};:` 等 |
| C-19 | **路径白名单** | 写操作限制在工作目录内 |
| C-20 | **彩色输出** | 工具调用、文本输出、权限请求不同颜色区分 |

#### 🟠 Phase 2：好用版本（6 周）

| 编号 | 功能 | 说明 |
|------|------|------|
| C-21 | **三种工作模式** | default（确认）/ fast（自动）/ plan（先计划后执行） |
| C-22 | **文件树感知** | 启动时扫描项目结构，自动识别语言/框架 |
| C-23 | **Web UI 界面** | Hono + React + SSE |
| C-24 | **Diff 预览** | 每次文件编辑显示 diff（类 `git diff` 格式） |
| C-25 | **语义搜索** | nomic-embed-text 向量化 + Chroma 检索 |
| C-26 | **Web 搜索** | 联网搜索 API 文档和解决方案 |
| C-27 | **Git 集成** | status / diff / commit / log |
| C-28 | **SSE 流式输出** | 所有 Agent 过程实时流式推送到 Web UI |
| C-29 | **Checkpoint 回滚** | 文件快照回滚（保存修改前的文件内容） |

#### 🔵 Phase 3：强大版本（8 周）

| 编号 | 功能 | 说明 |
|------|------|------|
| C-30 | **MCP 协议扩展** | 兼容 MCP Server，接入外部工具 |
| C-31 | **子代理并行** | 复杂任务拆解为多个子 Agent 并行执行 |
| C-32 | **LSP 集成** | 跳转定义、查找引用、类型信息 |
| C-33 | **Code Review** | 自动 PR 审查 |
| C-34 | **Skill 系统** | 可复用技能包（"搭建 React 项目"等） |
| C-35 | **Sandbox 沙箱** | Docker 沙箱运行不可信代码 |

### 1.3 功能优先级矩阵

```
                  高价值
                    │
    Phase 1 ◄───────┼───────► Phase 2
    CODEX.md         │       Web UI
    双模型           │       Diff 预览
    审计             │       语义搜索
    权限分层         │       SSE 流式
                    │
    低复杂度 ────────┼─────── 高复杂度
                    │
    Phase 0 ◄───────┼───────► Phase 3
    Agent Loop       │       MCP 扩展
    基础 7 工具      │       子代理
    CLI REPL         │       LSP 集成
    最小确认         │       Sandbox
                    │
                  低价值
```

---

## 2. 技术选型（精确到包名版本）

### 2.1 技术栈全景

```
Layer                    Technology            Version       License
───────────────────────  ────────────────────  ────────────  ──────────
Runtime                  Node.js               22 LTS        MIT
Language                 TypeScript            5.7+          Apache-2.0
Package Manager          pnpm                  10.x          MIT
Monorepo Tool            Turborepo             3.x           MIT
────────────────────────────────────────────────────────────────────
CLI Framework            ink                   5.x           MIT
CLI Rendering            react                 18.x          MIT
CLI Spinner              @clack/prompts        0.10.x        MIT
CLI Color                picocolors            1.x           MIT
────────────────────────────────────────────────────────────────────
Web Server (API)         hono                  4.7.x         MIT
Web UI Framework         react                 19.x          MIT
Web UI Build             vite                  6.x           MIT
Web UI Components        shadcn/ui             latest        MIT
Web UI CSS               tailwindcss           4.x           MIT
────────────────────────────────────────────────────────────────────
LLM SDK                  ai                    4.x           Apache-2.0
LLM Claude Adapter       @ai-sdk/anthropic     2.x           Apache-2.0
LLM OpenAI Adapter       @ai-sdk/openai        2.x           Apache-2.0
LLM Token Counting       tiktoken              1.x           MIT
────────────────────────────────────────────────────────────────────
Schema Validation        zod                   3.24.x        MIT
Error Types              neverthrow            8.x           MIT
────────────────────────────────────────────────────────────────────
Vector DB (local)        chromadb              2.x           Apache-2.0
Embedding (local)        @xenova/transformers  2.x           Apache-2.0
────────────────────────────────────────────────────────────────────
Subprocess               execa                 9.x           MIT
File Watching            chokidar              4.x           MIT
────────────────────────────────────────────────────────────────────
Testing                  vitest                3.x           MIT
E2E Testing              playwright            1.52.x        Apache-2.0
────────────────────────────────────────────────────────────────────
Logging                  pino                  9.x           MIT
CLI Arguments            commander             13.x          MIT
Config Storage           conf                  13.x          MIT
────────────────────────────────────────────────────────────────────
Git Operations           isomorphic-git        1.x           MIT
WebSocket (Web)          @hono/hono-ws         1.x           MIT
```

### 2.2 精确依赖清单（package.json 核心块）

```jsonc
{
  "dependencies": {
    // === Agent Core ===
    "ai": "^4.2.0",                    // Vercel AI SDK 核心
    "@ai-sdk/anthropic": "^2.1.0",     // Claude Adapter
    "@ai-sdk/openai": "^2.2.0",        // OpenAI / DeepSeek Adapter
    "zod": "^3.24.0",                  // 运行时类型校验
    "neverthrow": "^8.2.0",            // Result<T, E> 类型
    "tiktoken": "^1.0.0",              // Token 计数

    // === CLI ===
    "ink": "^5.2.0",                   // 终端 React 渲染
    "react": "^18.3.0",                // Ink 的 peer dependency
    "picocolors": "^1.1.0",            // 终端颜色
    "@clack/prompts": "^0.10.0",       // 交互式提示（确认/选择）
    "commander": "^13.1.0",            // CLI 参数解析
    "conf": "^13.1.0",                 // JSON 配置文件存储

    // === 子进程 ===
    "execa": "^9.5.0",                 // 子进程管理

    // === 文件系统 ===
    "chokidar": "^4.0.0",              // 文件变更监听
    "ignore": "^7.0.0",                // .gitignore 规则匹配

    // === 搜索 ===
    "fast-glob": "^3.3.0",             // 高性能 glob 搜索
    "ignore-walk": "^7.0.0"            // 遍历时忽略 .gitignore
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "@types/react": "^18.3.0",
    "tsup": "^8.3.0"                   // 构建
  },
  "optionalDependencies": {
    // === Web UI（仅在 Web 模式下需要） ===
    "hono": "^4.7.0",
    "@hono/hono-ws": "^1.0.0",

    // === 向量搜索（lazy import） ===
    "chromadb": "^2.0.0",
    "@xenova/transformers": "^2.0.0"
  }
}
```

### 2.3 关键选型决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| **LLM SDK** | Vercel AI SDK (ai) | 统一 streamText() API 对接所有模型，内置 tool calling 解析，无需自己拼 JSON |
| **配置存储** | conf (npm) | 自动处理 `~/.codex/config.json`，JSON Schema 类型推断 |
| **子进程** | execa | 比 child_process 多了 stdout/stderr 流式、超时、kill 链、Windows 兼容 |
| **Token 计数** | tiktoken | OpenAI 开源的 tokenizer，精确计数，支持多种模型编码 |
| **结果类型** | neverthrow | 强制处理错误，替代 try-catch 的 TypeScript 友好方案 |
| **CLI 交互** | @clack/prompts | 比 raw inquirer 更轻量，内置 spinner、confirm、select |
| **日志** | pino | 结构化 JSON 日志，生产级，支持多路传输 |
| **构建** | tsup | 基于 esbuild 的 TS 打包器，秒级构建 CLI bundle |
| **Vector DB** | chromadb (本地 Python 进程) | 纯本地运行，零配置，支持 cosine 搜索。替代品：LanceDB |
| **Git** | isomorphic-git | 纯 JS 实现，无需本地 git 命令，支持 submodule |
| **路径匹配** | ignore | 用 .gitignore 规则判断文件是否应被排除 |

### 2.4 为什么不是 ...

| 被否决的技术 | 理由 |
|-------------|------|
| **Rust** — CLI 更快、二进制分发 | 开发效率 > 运行时性能。Agent 瓶颈在 LLM 延迟（秒级），CPU 操作（微秒级）不重要。如果未来需要分发单文件二进制，可以用 **pkg** 或 **bun build --compile** |
| **Python** — AI 生态更丰富 | 全栈统一语言更重要：前端/后端/CLI 都用一个语言，团队不需要在 Python 和 JS 之间切换 |
| **Deno / Bun** — 更快运行时 | Node.js 22 LTS 在工具调用场景已经足够成熟，npm 生态最大。Bun 可以作为构建工具 |
| **LangChain** — 功能全面 | 太重量级，对 Agent Loop 的控制不够精细。我们需要自己控制每条消息和每个工具调用，而不是被框架抽象掉 |
| **gRPC** | CLI 场景用不到，HTTP + SSE 足够 |
| **WebSocket (双向)** | Phase 0-2 只需要 Server→Client 单向流式，SSE 更简单。WebSocket 在 Phase 3 子代理场景才需要 |

---

## 3. 系统架构

### 3.1 架构总览（简化版，聚焦 Phase 0-1 核心）

```
┌──────────────────────────────────────────────────────┐
│                    用户交互                            │
│  终端 ──► codex 命令 ──► REPL / 一次命令模式           │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│                  Agent Core                            │
│                                                       │
│  ┌──────────────┐    ┌──────────────────────────┐    │
│  │   System     │    │      Agent Loop           │    │
│  │   Prompt     │    │                          │    │
│  │  Builder     │    │  while:                  │    │
│  │              │    │  1. buildMessages()      │    │
│  │  • 角色定义   │    │  2. llm.streamChat()    │    │
│  │  • 项目配置   │    │  3. parseToolCalls()     │    │
│  │  • 工具定义   │    │  4. executeTool()        │    │
│  └──────────────┘    │  5. addResult()           │    │
│                       │  6. checkStop()          │    │
│  ┌──────────────┐    └──────────┬───────────────┘    │
│  │  Context     │               │                    │
│  │  Manager     │    ┌──────────▼───────────────┐    │
│  │              │    │      Tool Registry        │    │
│  │  • 短程消息   │    │                          │    │
│  │  • Token预算  │    │  read_file ──► 文件系统   │    │
│  │  • 摘要压缩   │    │  write_file ──► 文件系统   │    │
│  └──────────────┘    │  edit_file ──► 文件系统   │    │
│                       │  bash ───────► execa      │    │
│  ┌──────────────┐    │  glob ───────► fast-glob  │    │
│  │  Checkpoint  │    │  grep ───────► ripgrep    │    │
│  │  Manager     │    │  list_dir ──► fs.readdir  │    │
│  └──────────────┘    └──────────────────────────┘    │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │              Security Layer                   │    │
│  │  Permission Check → Path Validation         │    │
│  │  Command Filter → Audit Logger               │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│                  Model Layer                           │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Claude   │  │ DeepSeek │  │ Ollama (本地)     │   │
│  │ Sonnet 4 │  │ V4       │  │ Qwen2.5-Coder    │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
│                 统一接口: streamText()                 │
└──────────────────────────────────────────────────────┘
```

### 3.2 模块依赖关系

```
cli/
  ├── commands/repl.ts    依赖 → core/agent/loop.ts
  ├── commands/once.ts    依赖 → core/agent/loop.ts
  └── components/         使用 → core/types.ts

core/
  ├── agent/
  │   ├── loop.ts         依赖 → llm/, tools/, context/, security/
  │   ├── prompt.ts       依赖 → context/, types.ts
  │   └── modes.ts        纯状态机
  ├── tools/
  │   ├── registry.ts     依赖 → types.ts
  │   ├── read.ts         依赖 → fs
  │   ├── write.ts        依赖 → fs, security/
  │   └── ...
  ├── context/
  │   ├── manager.ts      依赖 → types.ts
  │   └── budget.ts       依赖 → tiktoken
  ├── security/
  │   ├── permissions.ts  依赖 → types.ts
  │   ├── command-filter.ts 独立
  │   └── path-validator.ts 独立
  ├── checkpoint.ts       依赖 → fs, types.ts
  └── types.ts            零依赖（纯类型定义）

llm/
  ├── client.ts           依赖 → ai, @ai-sdk/*
  └── token-counter.ts    依赖 → tiktoken
```

---

## 4. 数据模型设计

### 4.1 核心类型定义

```typescript
// ─── src/core/types.ts ───

// === 消息 ===
export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
  timestamp: number;
  tokenCount: number;
}

// === 工具调用 ===
export interface ToolCall {
  id: string;              // LLM 生成的调用 ID
  toolName: string;        // 如 "read_file"
  args: Record<string, unknown>;  // 工具参数
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  data: unknown;           // 成功返回数据
  error?: string;          // 失败错误信息
  isFinal?: boolean;       // 是否终止 Loop
  duration: number;        // 执行耗时 (ms)
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
  permissions: ToolPermissions;
}

export interface ToolContext {
  session: Session;
  workspace: string;
  security: SecurityContext;
}

// === 权限 ===
export interface ToolPermissions {
  requiresConfirm: boolean;
  safetyLevel: 'safe' | 'caution' | 'danger';
  allowedPaths?: string[];
  blockedCommands?: string[];
  timeout?: number;
}

export interface SecurityContext {
  workspace: string;         // 工作目录根
  cwd: string;               // 当前目录
  gitignore: IgnoreFilter;   // .gitignore 规则
  allowedDomains: string[];  // 允许的网络请求域名
}

// === 会话 ===
export interface Session {
  id: string;
  workspace: string;
  mode: WorkMode;
  modelId: string;
  messages: Message[];
  createdAt: number;
  lastActiveAt: number;
  toolCallCount: number;
  // 事件总线
  on: (event: string, cb: Function) => void;
  emit: (event: string, data: unknown) => void;
}

export type WorkMode = 'default' | 'fast' | 'plan';

// === 检查点 ===
export interface Checkpoint {
  id: string;
  sessionId: string;
  timestamp: number;
  stepIndex: number;
  files: Map<string, string>;   // 文件路径 → 快照内容
  messages: Message[];
}

// === 审计 ===
export interface AuditEntry {
  timestamp: string;
  sessionId: string;
  action: string;
  params: string;               // JSON 脱敏
  result: 'approved' | 'denied' | 'error';
  duration: number;
}

// === 配置 ===
export interface CodexConfig {
  model: {
    provider: 'anthropic' | 'openai' | 'ollama';
    modelId: string;
    apiKey?: string;            // 仅运行时，不持久化
    baseUrl?: string;           // 兼容 OpenAI 格式
    maxTokens: number;
  };
  workspace: {
    root: string;
    ignorePatterns: string[];
  };
  mode: WorkMode;
  security: {
    confirmFileWrites: boolean;
    confirmCommands: boolean;
    confirmNetwork: boolean;
    blockedCommands: string[];
  };
}
```

### 4.2 数据存储结构

```
~/.codex/                          # 用户级配置目录
├── config.json                    # 全局配置（conf 包管理）
│   {
│     "defaultModel": "claude-sonnet-4",
│     "defaultMode": "default",
│     "theme": "dark",
│     "recentWorkspaces": ["/path/to/proj1", "/path/to/proj2"]
│   }
│
├── keys.json                      # API Key 加密存储
│   {
│     "anthropic": "sk-ant-encrypted...",
│     "openai": "sk-encrypted..."
│   }
│
├── audit/                         # 审计日志
│   ├── 2026-07-14.jsonl
│   └── ...
│
├── sessions/                      # 会话持久化
│   ├── sess_abc123.json
│   └── ...
│
└── checkpoints/                   # 检查点快照
    ├── sess_abc123/
    │   ├── cp_001.json
    │   └── snapshots/
    │       ├── src/app.ts.001
    │       └── ...
    └── ...
```

---

## 5. 详细 API 设计

### 5.1 内部 API（core 包导出接口）

```typescript
// ─── Agent Core API（供 CLI/Web 调用） ───

export class CodexAgent {
  constructor(config: Partial<CodexConfig>);

  // 创建新会话
  createSession(workspace: string, mode?: WorkMode): Session;

  // 运行一次完整对话（流式）
  run(
    sessionId: string,
    userInput: string
  ): AsyncGenerator<AgentEvent, AgentResult, void>;

  // 权限确认回调
  confirmPermission(sessionId: string, toolCallId: string, approved: boolean): void;

  // 检查点
  listCheckpoints(sessionId: string): Checkpoint[];
  rollback(sessionId: string, checkpointId: string): Promise<void>;

  // 会话管理
  listSessions(): SessionSummary[];
  deleteSession(sessionId: string): void;
}

// ─── 事件类型（流式输出合约） ───
export type AgentEvent =
  | { type: 'thinking'; content: string }
  | { type: 'text'; content: string }
  | { type: 'text-done' }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-start'; toolCallId: string }
  | { type: 'tool-result'; toolCallId: string; success: boolean; data: unknown }
  | { type: 'tool-error'; toolCallId: string; error: string }
  | { type: 'permission-request'; toolCallId: string; description: string; safetyLevel: string }
  | { type: 'checkpoint'; checkpointId: string }
  | { type: 'plan'; steps: PlanStep[] }
  | { type: 'done'; result: string }
  | { type: 'error'; message: string }
```

### 5.2 HTTP API（Web UI 模式）

```typescript
// ═════════════════════════════════════════════════
// 会话管理
// ═════════════════════════════════════════════════

// 创建会话
POST /api/v1/sessions
Request:  { "workspace": "/path", "model": "claude-sonnet-4", "mode": "default" }
Response: { "sessionId": "sess_abc123", "createdAt": 1234567890 }

// 列出会话
GET /api/v1/sessions
Response: { "sessions": [{ "sessionId": "...", "mode": "default", "messageCount": 5, "lastActiveAt": 1234567890 }] }

// 删除会话
DELETE /api/v1/sessions/:sessionId
Response: 204 No Content

// ═════════════════════════════════════════════════
// 对话
// ═════════════════════════════════════════════════

// 发送消息 → SSE 流式返回
POST /api/v1/sessions/:sessionId/messages
Request:  { "content": "帮我创建一个 React 组件库" }
Response: SSE stream
  event: thinking
  data: {"content": "我来分析一下项目结构..."}

  event: text
  data: {"content": "首先我看看当前目录有什么"}

  event: tool-call
  data: {"toolCallId": "call_001", "toolName": "list_dir", "args": {"path": "."}}

  event: permission-request
  data: {"toolCallId": "call_001", "description": "列出当前目录", "safetyLevel": "safe"}

  // 用户通过另一个 API 返回确认
  // ...

  event: tool-start
  data: {"toolCallId": "call_001"}

  event: tool-result
  data: {"toolCallId": "call_001", "success": true, "data": {"files": ["package.json", "src/"]}}

  // ... 持续循环 ...

  event: done
  data: {"result": "已完成。我创建了一个 React 组件库项目，包括..."}

// ═════════════════════════════════════════════════
// 权限确认
// ═════════════════════════════════════════════════

POST /api/v1/sessions/:sessionId/permissions
Request:  { "toolCallId": "call_001", "approved": true }
Response: 200 OK

// ═════════════════════════════════════════════════
// 检查点
// ═════════════════════════════════════════════════

GET /api/v1/sessions/:sessionId/checkpoints
Response: { "checkpoints": [{ "id": "cp_001", "timestamp": 1234567890, "stepIndex": 3 }] }

POST /api/v1/sessions/:sessionId/checkpoints/:checkpointId/rollback
Response: { "status": "rolled_back", "checkpointId": "cp_001" }

// ═════════════════════════════════════════════════
// 系统
// ═════════════════════════════════════════════════

GET  /api/v1/health
Response: { "status": "ok", "version": "0.1.0" }

GET  /api/v1/models
Response: { "models": ["claude-sonnet-4", "deepseek-v4", "ollama/qwen2.5-coder"] }
```

### 5.3 CLI 命令设计

```bash
# ─── 命令结构 ───
codex [command] [options]

# ─── 命令列表（Phase 0-1）───

# 交互式 REPL（默认命令）
codex
# 启动 REPL 进入交互模式

# 一次命令
codex "帮我创建一个 Vite + React 项目"
codex -p "分析这个项目的依赖关系"
codex --prompt "解释 src/utils.ts 的作用"

# 带选项
codex -d /path/to/project "给所有组件添加单元测试"
codex --model claude-sonnet-4 "重构 UserService"
codex --mode plan "添加用户认证模块"

# 管道
cat error.log | codex "分析这些错误"

# 子命令
codex config set model claude-sonnet-4    # 设置默认模型
codex config get model                     # 查看配置
codex config list                          # 查看所有配置

codex session list                         # 列出会话
codex session delete sess_abc123           # 删除会话

codex version                             # 版本信息
codex update                              # 自动更新
codex help                                # 帮助

# ─── 参数定义（commander）───
# -p, --prompt <text>     一次命令模式
# -d, --dir <path>        指定工作目录
# --model <id>            指定模型
# --mode <mode>           指定工作模式 (default|fast|plan)
# --dangerously-skip-permissions  跳过权限确认
# -v, --version          版本信息
# -h, --help             帮助信息
```

---

## 6. 核心模块实现

### 6.1 Agent Loop（最关键的 ~80 行代码）

```typescript
// ─── core/src/agent/loop.ts ───

import { streamText } from 'ai';
import type { Session, AgentEvent, AgentResult, Message, ToolCall } from '../types';

export class AgentLoop {
  private maxIterations = 25;

  async *run(
    session: Session,
    userInput: string,
    opts: {
      llm: LLMClient;
      tools: ToolRegistry;
      context: ContextManager;
      security: SecurityLayer;
      prompt: PromptBuilder;
    }
  ): AsyncGenerator<AgentEvent, AgentResult, void> {

    // 1. 添加用户消息
    session.messages.push(this.buildUserMessage(userInput));

    let iteration = 0;
    let finalText = '';

    while (iteration < this.maxIterations) {
      iteration++;

      // 2. 构建消息列表（含上下文压缩）
      const messages = opts.context.buildMessages(session);

      // 3. 调用 LLM，流式读取
      const result = streamText({
        model: opts.llm.getModel(session.modelId),
        messages,
        tools: opts.tools.getToolDefinitions(),
        maxSteps: 1,  // 每轮只处理一次工具调用，由外层循环控制
      });

      // 4. 处理流式输出
      let toolCalls: ToolCall[] = [];

      for await (const chunk of result.textStream) {
        finalText += chunk;
        yield { type: 'text', content: chunk };
      }
      yield { type: 'text-done' };

      // 5. 提取工具调用
      toolCalls = result.toolCalls || [];
      if (toolCalls.length === 0) break;  // 没有工具调用 → 终止

      // 6. 逐个执行工具
      for (const toolCall of toolCalls) {
        // 安全检查
        const permission = opts.security.check(toolCall, session);
        if (!permission.allowed) {
          yield { type: 'error', message: `工具 ${toolCall.toolName} 被安全策略拒绝` };
          return { success: false, error: 'Permission denied' };
        }

        // 发出权限请求（Web UI 层或 CLI 层负责展示并收集用户确认）
        if (permission.needsConfirm) {
          yield {
            type: 'permission-request',
            toolCallId: toolCall.id,
            description: `执行 ${toolCall.toolName}(${JSON.stringify(toolCall.args)})`,
            safetyLevel: permission.safetyLevel,
          };
          // 这里会暂停，等待外部调用 confirmPermission()
          const approved = await session.waitForPermission(toolCall.id);
          if (!approved) {
            yield { type: 'tool-result', toolCallId: toolCall.id, success: false, data: null };
            continue;
          }
        }

        // 执行工具
        yield { type: 'tool-start', toolCallId: toolCall.id };
        const startTime = Date.now();
        try {
          const result = await opts.tools.execute(toolCall, {
            session,
            workspace: session.workspace,
            security: opts.security.getContext(),
          });
          result.duration = Date.now() - startTime;

          // 记录到会话
          session.messages.push({
            id: crypto.randomUUID(),
            role: 'tool',
            content: JSON.stringify(result.data),
            toolCallId: toolCall.id,
            toolName: toolCall.toolName,
            timestamp: Date.now(),
            tokenCount: 0,
          });

          yield { type: 'tool-result', toolCallId: toolCall.id, success: result.success, data: result.data };

          if (result.isFinal) {
            return { success: true, data: result.data };
          }
        } catch (err) {
          yield { type: 'tool-error', toolCallId: toolCall.id, error: String(err) };
        }
      }
    }

    yield { type: 'done', result: finalText };
    return { success: true, data: finalText };
  }
}
```

### 6.2 工具实现模式（以 edit_file 为例）

```typescript
// ─── core/src/tools/edit.ts ───

import { z } from 'zod';
import fs from 'fs/promises';
import type { ToolDefinition, ToolResult, ToolContext } from '../types';

const editSchema = z.object({
  path: z.string().describe('文件路径（相对工作目录）'),
  old_string: z.string().describe('被替换的文本，必须唯一匹配'),
  new_string: z.string().describe('替换后的文本'),
});

export const editFileTool: ToolDefinition = {
  name: 'edit_file',
  description: '在文件中精确替换一段文本。比 write_file 更精确，推荐用于修改已有文件。',
  parameters: editSchema.shape,
  permissions: {
    requiresConfirm: true,
    safetyLevel: 'caution',
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const parsed = editSchema.safeParse(args);
    if (!parsed.success) {
      return { toolCallId: '', success: false, data: null, error: parsed.error.message, duration: 0 };
    }

    const { path, old_string, new_string } = parsed.data;
    const fullPath = path.startsWith('/') ? path : `${ctx.workspace}/${path}`;

    // 路径安全性校验
    PathValidator.assertWithinWorkspace(fullPath, ctx.workspace);

    // 读取文件
    const content = await fs.readFile(fullPath, 'utf-8');

    // 检查唯一性
    const count = content.split(old_string).length - 1;
    if (count === 0) {
      return { toolCallId: '', success: false, data: null, error: `"${old_string}" 在文件中未找到`, duration: 0 };
    }
    if (count > 1) {
      return { toolCallId: '', success: false, data: null, error: `"${old_string}" 在文件中出现 ${count} 次，不唯一`, duration: 0 };
    }

    // 执行替换
    const newContent = content.replace(old_string, new_string);
    await fs.writeFile(fullPath, newContent, 'utf-8');

    return {
      toolCallId: '',
      success: true,
      data: {
        path,
        oldLength: old_string.length,
        newLength: new_string.length,
        // diff 信息供 UI 渲染
        diff: generateDiff(content, newContent),
      },
      duration: 0,
    };
  },
};
```

### 6.3 上下文管理策略

```typescript
// ─── core/src/context/manager.ts ───

const TOKEN_BUDGET = {
  maxTotal: 128_000,       // 总上限（按模型调整）
  systemReserved: 8_000,   // 系统提示词 + 工具定义
  toolResults: 40_000,     // 工具结果缓存（优先驱逐）
  conversation: 80_000,    // 对话历史
};

export class ContextManager {
  // 策略：三级驱逐
  buildMessages(session: Session): Message[] {
    const system = this.buildSystemMessages(session);
    const conversation = this.pruneConversation(session.messages);
    return [...system, ...conversation];
  }

  private pruneConversation(messages: Message[]): Message[] {
    let total = 0;
    const kept: Message[] = [];

    // 从后往前保留——最近的对话最重要
    for (const msg of [...messages].reverse()) {
      const tokens = estimateTokens(msg.content);
      if (total + tokens > TOKEN_BUDGET.conversation) break;
      total += tokens;
      kept.unshift(msg);
    }

    // 如果对话太长，用摘要替换最早的部分
    if (messages.length > kept.length + 3) {
      const evicted = messages.slice(0, messages.length - kept.length);
      const summary = summarizeMessages(evicted);
      kept.unshift({
        id: 'summary',
        role: 'system',
        content: `[上下文摘要]: ${summary}`,
        timestamp: evicted[0]?.timestamp ?? 0,
        tokenCount: estimateTokens(summary),
      });
    }

    return kept;
  }
}
```

### 6.4 系统提示词结构

```typescript
// ─── core/src/agent/prompt.ts ───

// 提示词分四段，每段职责明确
export function buildSystemPrompt(session: Session, config: CodexConfig): string {
  return `
你是一个 AI 编程助手，名叫 Codex。

## 工作方式
- 你会反复执行"思考→调用工具→观察结果"的循环，直到任务完成
- 每次调用工具前，先思考当前进度和下一步计划
- 使用中文与用户交流

## 可用工具
${TOTAL_TOOL_DEFINITIONS}

## 当前项目
工作目录: ${session.workspace}
项目配置: ${JSON.stringify(config, null, 2)}

## 规则
1. 不要假设文件存在——先读取确认
2. 修改前先理解文件内容
3. 一次工具调用只做一件事
4. 如果任务复杂，先输出计划
5. 需要更多信息时，用 grep 搜索代码库
6. 遇到错误时，分析原因并解释
7. 不要删除用户没有要求删除的文件
8. 修改配置文件(.env, config)前必须谨慎
  `.trim();
}
```

### 6.5 安全检查实现

```typescript
// ─── core/src/security/command-filter.ts ───

const BLOCKED_COMMANDS = [
  /^rm\s+-rf\s+\/$/,              // rm -rf /
  /^rm\s+-rf\s+\/home/,           // rm -rf /home
  /^dd\s+if=/,                     // dd if=
  /^:\(\)\{\s*:\|\s*:&\s*\}\s*;/, // fork bomb
  /^mkfs/,                         // 格式化
  /^>\/dev\/sda/,                  // 直接写硬盘
  /^chmod\s+-R\s+777\s+\/$/,      // 改根目录权限
  /^curl\s+.*\||.*\|bash/,        // curl pipe bash
  /^wget\s+.*-O-\s+\|bash/,       // wget pipe bash
  /^sudo/,                         // sudo 命令
  /^su\s/,                         // su 切换用户
];

export function isCommandBlocked(command: string): { blocked: boolean; reason?: string } {
  const clean = command.trim().replace(/\s+/g, ' ');
  for (const pattern of BLOCKED_COMMANDS) {
    if (pattern.test(clean)) {
      return { blocked: true, reason: `命令 "${clean}" 被安全策略拦截` };
    }
  }
  return { blocked: false };
}
```

### 6.6 权限确认流程

```
用户输入                                 Agent Loop
    │                                       │
    │         思考 / 输出文本                │
    │ ◄────────────────────────────────── │
    │                                       │
    │         工具调用: edit_file src/app.ts │
    │ ◄────────────────────────────────── │
    │                                       │
    │  "即将修改 src/app.ts，确认? [Y/n]"    │
    │ ──────────────────────────────────► │
    │                                       │
    │          确认 [Y]                      │
    │ ──────────────────────────────────► │
    │                                       │  → 执行工具
    │         修改结果 / Diff                │
    │ ◄────────────────────────────────── │
    │                                       │
    │        继续思考 / 下一步              │
    │ ◄────────────────────────────────── │
```

---

## 7. 配置与环境管理

### 7.1 环境变量

```bash
# ─── .env 文件 ───

# 模型配置（必须至少配置一个）
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...

# 默认模型
CODEX_DEFAULT_MODEL=claude-sonnet-4

# 工作目录（默认当前目录）
CODEX_WORKSPACE=/path/to/project

# 安全（可选覆盖）
CODEX_BLOCKED_COMMANDS=rm,sudo,dd
CODEX_CONFIRM_FILE_WRITES=true
CODEX_CONFIRM_COMMANDS=true

# 调试
CODEX_DEBUG=false
CODEX_LOG_LEVEL=info
```

### 7.2 配置优先级

```
命令行参数 > 环境变量 > 全局配置 ~/.codex/config.json > 项目 CODEX.md > 默认值
```

### 7.3 .env.example

```bash
# Codex AI 环境配置
# 复制此文件为 .env 并填入你的 API Key

# === 模型配置（至少配置一个）===
# Anthropic Claude
# ANTHROPIC_API_KEY=

# DeepSeek（兼容 OpenAI 格式）
# DEEPSEEK_API_KEY=
# DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# 本地 Ollama
# OLLAMA_BASE_URL=http://localhost:11434/v1

# === 可选配置 ===
# CODEX_DEFAULT_MODEL=claude-sonnet-4
# CODEX_DEFAULT_MODE=default
# CODEX_LOG_LEVEL=info
```

---

## 8. 错误处理体系

### 8.1 错误类型层次

```typescript
// ─── core/src/types.ts（错误部分）───

// 所有业务错误的基类
export class CodexError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly severity: 'error' | 'warn' | 'info',
  ) {
    super(message);
    this.name = 'CodexError';
  }
}

// 工具执行错误
export class ToolExecutionError extends CodexError {
  constructor(toolName: string, reason: string) {
    super(`工具 ${toolName} 执行失败: ${reason}`, 'TOOL_EXECUTION_ERROR', 'error');
  }
}

// 参数校验错误
export class ValidationError extends CodexError {
  constructor(public readonly field: string, message: string) {
    super(`参数校验失败: ${message}`, 'VALIDATION_ERROR', 'error');
  }
}

// 安全拒绝错误
export class SecurityDeniedError extends CodexError {
  constructor(action: string, reason: string) {
    super(`安全拦截: ${action} — ${reason}`, 'SECURITY_DENIED', 'warn');
  }
}

// 文件未找到
export class FileNotFoundError extends CodexError {
  constructor(path: string) {
    super(`文件未找到: ${path}`, 'FILE_NOT_FOUND', 'info');
  }
}

// 工具未找到
export class ToolNotFoundError extends CodexError {
  constructor(toolName: string) {
    super(`工具未找到: ${toolName}`, 'TOOL_NOT_FOUND', 'error');
  }
}

// LLM 调用错误
export class LLMError extends CodexError {
  constructor(cause: string) {
    super(`模型调用失败: ${cause}`, 'LLM_ERROR', 'error');
  }
}

// 会话错误
export class SessionError extends CodexError {
  constructor(message: string) {
    super(message, 'SESSION_ERROR', 'error');
  }
}
```

### 8.2 全局错误处理

```typescript
// ─── core/src/error-handler.ts ───

import { CodexError, ToolExecutionError, SecurityDeniedError, LLMError, ValidationError } from './types';
import pino from 'pino';

const logger = pino({ name: 'codex' });

export function handleError(error: unknown): { userMessage: string; logData: Record<string, unknown> } {
  const logData: Record<string, unknown> = {};

  if (error instanceof CodexError) {
    logData.code = error.code;
    logData.severity = error.severity;

    switch (true) {
      case error instanceof SecurityDeniedError:
        return {
          userMessage: `🛡️ ${error.message}`,
          logData,
        };
      case error instanceof ValidationError:
        return {
          userMessage: `📋 参数错误: ${error.message}`,
          logData,
        };
      case error instanceof ToolExecutionError:
        return {
          userMessage: `🔧 工具执行失败: ${error.message}`,
          logData,
        };
      case error instanceof LLMError:
        logger.error(error, 'LLM 调用失败');
        return {
          userMessage: `🤖 模型调用失败，请检查 API Key 和网络连接: ${error.message}`,
          logData,
        };
      default:
        return {
          userMessage: `❌ ${error.message}`,
          logData,
        };
    }
  }

  // 未知错误
  if (error instanceof Error) {
    logger.error(error, '未预期的错误');
    return {
      userMessage: '❌ 发生了未预期的错误，请重试或查看日志',
      logData: { stack: error.stack ?? '' },
    };
  }

  return {
    userMessage: '❌ 未知错误',
    logData: { raw: String(error) },
  };
}
```

---

## 9. 测试策略

### 9.1 测试金字塔

```
        ╱╲
       ╱ E2E ╲           Playwright 模拟终端输入输出
      ╱────────╲         Phase 0: 3 个核心场景
     ╱ Integration ╲      Agent Loop 与真实 LLM 的集成
    ╱──────────────╲     Phase 0: 5 个场景
   ╱   Unit Tests    ╲    工具函数、安全检查、上下文管理
  ╱──────────────────╲  Phase 0: 20+ 测试用例
```

### 9.2 单元测试

```typescript
// ─── core/__tests__/tools/edit.test.ts ───

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const testDir = path.join(os.tmpdir(), 'codex-test-' + Date.now());

describe('edit_file', () => {
  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'test.ts'), 'const x = 1;\nconst y = 2;\n');
  });

  it('应该精确替换文本', async () => {
    const result = await editFileTool.execute(
      { path: 'test.ts', old_string: 'const x = 1;', new_string: 'const x = 10;' },
      mockContext(testDir)
    );
    expect(result.success).toBe(true);
    const content = await fs.readFile(path.join(testDir, 'test.ts'), 'utf-8');
    expect(content).toBe('const x = 10;\nconst y = 2;\n');
  });

  it('非唯一匹配应该报错', async () => {
    await fs.writeFile(path.join(testDir, 'dup.ts'), 'const a = 1;\nconst a = 2;\n');
    const result = await editFileTool.execute(
      { path: 'dup.ts', old_string: 'const a =', new_string: 'const b =' },
      mockContext(testDir)
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('不唯一');
  });

  it('不存在的字符串应该报错', async () => {
    const result = await editFileTool.execute(
      { path: 'test.ts', old_string: 'not exist', new_string: 'nothing' },
      mockContext(testDir)
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('未找到');
  });
});
```

### 9.3 集成测试（Mock LLM）

```typescript
// ─── core/__tests__/agent/loop.test.ts ───

// 使用 Mock LLM 模拟工具调用，不依赖真实 API
describe('Agent Loop', () => {
  it('应该处理 读文件 → 分析 → 写新文件 的三步任务', async () => {
    const session = createSession('/test');
    const mockLLM = createMockLLM([
      // 第一轮：输出文本 + 调用 read_file
      { type: 'text', content: '让我先读取源文件' },
      { type: 'tool-call', toolName: 'read_file', args: { path: 'src/data.ts' } },
      // 第二轮：输出文本 + 调用 write_file
      { type: 'text', content: '基于分析，创建新文件' },
      { type: 'tool-call', toolName: 'write_file', args: { path: 'src/result.ts', content: '// 新文件' } },
      // 第三轮：最终回复
      { type: 'text', content: '完成！' },
    ]);

    const agent = new AgentLoop();
    const events: AgentEvent[] = [];
    for await (const event of agent.run(session, '分析 src/data.ts 并创建转化结果', { llm: mockLLM, ... })) {
      events.push(event);
    }

    expect(events.filter(e => e.type === 'tool-call')).toHaveLength(2);
    expect(events.filter(e => e.type === 'text')).toHaveLength(3);
    expect(events.filter(e => e.type === 'done')).toHaveLength(1);
  });
});
```

### 9.4 测试运行命令

```bash
# 运行单元测试
pnpm vitest run

# 带覆盖报告
pnpm vitest run --coverage

# 监听模式
pnpm vitest

# 只运行工具测试
pnpm vitest run tools

# Phase 0 覆盖率目标：核心模块 > 80%
```

---

## 10. CI/CD 流水线

### 10.1 GitHub Actions

```yaml
# ─── .github/workflows/ci.yml ───

name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm vitest run --coverage
      - run: pnpm lint

  publish:
    needs: test
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm publish --access public
        env:
          NODE_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 10.2 版本号策略

```
遵循 SemVer: MAJOR.MINOR.PATCH

v0.1.0 — Phase 0 技术验证
v0.2.0 — Phase 1 可用版本
v0.3.0 — Phase 2 好用版本
v1.0.0 — Phase 3 正式发布
```

---

## 11. 性能基线

### 11.1 必须达标的指标

| 指标 | Phase 0 目标 | Phase 1 目标 | 测量方式 |
|------|-------------|-------------|---------|
| **Agent Loop 每轮延迟** | < 5s | < 3s | LLM 调用到下一个 LLM 调用的间隔 |
| **文件读取 (< 1MB)** | < 200ms | < 100ms | `console.time()` |
| **文件搜索 (10K 文件)** | < 1s | < 500ms | `console.time()` |
| **工具调用开销** | < 5ms | < 2ms | 排除 LLM 延迟后的纯工具执行时间 |
| **启动时间** | < 500ms | < 300ms | `time codex --version` |
| **内存占用 (空闲)** | < 50MB | < 30MB | `process.memoryUsage()` |
| **CLI REPL 响应** | < 100ms | < 50ms | 输入回车到看到 "思考中" 提示 |

### 11.2 安全校验性能

| 校验项 | 最大耗时 |
|--------|---------|
| 路径白名单检查 | < 1μs |
| 命令黑名单匹配（正则） | < 10μs |
| 审计日志写入（异步） | < 1ms |
| 权限确认流程 | 取决于用户响应速度（不计入工具执行时间） |

---

## 附录 A：Phase 0 精确文件清单

```
codex-ai/
├── package.json              # pnpm monorepo 根
├── pnpm-workspace.yaml
├── tsconfig.json
├── .env.example
├── .gitignore
│
├── packages/
│   └── core/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts              # 导出入口
│           ├── types.ts              # 所有类型定义
│           ├── agent/
│           │   ├── loop.ts           # Agent Loop ~80行
│           │   └── prompt.ts         # 系统提示词构建
│           ├── tools/
│           │   ├── registry.ts       # 工具注册表 ~30行
│           │   ├── read.ts           # 读文件 ~20行
│           │   ├── write.ts          # 写文件 ~20行
│           │   ├── edit.ts           # 编辑文件 ~40行
│           │   ├── bash.ts           # 命令执行 ~30行
│           │   ├── glob.ts           # 文件名搜索 ~20行
│           │   ├── grep.ts           # 内容搜索 ~30行
│           │   └── list-dir.ts       # 列目录 ~15行
│           ├── context/
│           │   ├── manager.ts        # 上下文管理 ~40行
│           │   └── budget.ts         # Token 预算 ~20行
│           ├── security/
│           │   ├── permissions.ts    # 权限检查 ~30行
│           │   ├── path-validator.ts # 路径校验 ~15行
│           │   └── command-filter.ts # 命令黑名单 ~20行
│           └── checkpoint.ts         # 检查点(内存版) ~30行
│
│   └── cli/
│       ├── package.json
│       └── src/
│           ├── index.ts             # 入口: commander 参数解析
│           ├── repl.tsx             # REPL: Ink 交互界面
│           └── components/
│               ├── input.tsx        # 输入框
│               └── output.tsx       # 输出渲染
│
├── docs/
│   ├── PRD.md
│   └── DEV_DESIGN.md
│
└── scripts/
    ├── dev.sh
    └── build.sh
```

**Phase 0 总计：约 15 个文件，核心代码约 500-600 行 TypeScript，不含 node_modules 约 100KB。**

---

## 附录 B：Phase 0 依赖安装脚本

```bash
#!/bin/bash
# Phase 0 一键初始化

mkdir -p codex-ai/packages/{core,cli}/src
cd codex-ai

# 根 package.json
cat > package.json << 'EOF'
{
  "name": "codex-ai",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm -r --parallel dev",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  }
}
EOF

# pnpm workspace
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'packages/*'
EOF

# tsconfig
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "declaration": true
  }
}
EOF

# 安装依赖
pnpm add -D typescript@5.7 vitest@3
pnpm add ai@4 @ai-sdk/anthropic@2 @ai-sdk/openai@2 zod@3 neverthrow@8
pnpm add ink@5 react@18 @types/react@18 picocolors@1 @clack/prompts@0
pnpm add commander@13 conf@13 execa@9 fast-glob@3

echo "Phase 0 初始化完成！运行 pnpm dev 开始开发"
```

---

## 附录 C：技术决策记录（ADR）

| ADR | 决策 | 日期 | 理由 |
|-----|------|------|------|
| 001 | TypeScript 全栈 | 2026-07-14 | CLI + Web + Core 统一语言，降低团队切换成本 |
| 002 | Vercel AI SDK | 2026-07-14 | 一行代码切换模型，内置 tool calling 解析 |
| 003 | Ink 做 CLI | 2026-07-14 | 组件化 CLI 渲染，React 开发者零学习成本 |
| 004 | conf 做存储 | 2026-07-14 | 自动 XDG 目录、JSON Schema 校验、加密支持 |
| 005 | neverthrow 做错误 | 2026-07-14 | 强制类型安全错误处理，消除隐藏的 try-catch |
| 006 | 拒绝 LangChain | 2026-07-14 | 对 Agent Loop 控制不够精细，太重 |

---

> **文档状态**: v1.1 精细化版本  
> **下一步**: 评审通过后，开始 Phase 0 编码（2 周交付可演示的 MVP）
