# 墨研小说系统

墨研是一个面向个人创作者的网页端小说创作产品。当前版本实现“五章短篇”主流程：故事大纲、人物小传、章节目录、第一章至第五章。每个步骤都从本地 Skill 读取创作规则，通过 DeepSeek 真实生成候选稿，并由用户确认后解锁下一步。

## 当前技术栈

- 前端：Next.js、React、Ant Design 5
- 后端：NestJS、PostgreSQL
- 大模型：DeepSeek OpenAI 兼容接口
- 本地阶段任务执行：NestJS 进程内异步执行，不依赖 Redis
- 测试：Node Test、Supertest、Playwright

项目没有内置 Mock 数据或假生成接口。没有配置 DeepSeek 密钥时，生成任务会明确返回 `DEEPSEEK_NOT_CONFIGURED`，不会伪造生成成功。

## 本地启动

1. 安装依赖：

   ```powershell
   npm install
   ```

2. 从 `.env.example` 复制一份 `.env`，设置本地 PostgreSQL 连接、JWT 密钥和新生成的 DeepSeek API Key。不要使用曾经粘贴到聊天、工单或代码仓库中的密钥。

3. 启动 PostgreSQL，创建 `moyan` 数据库，然后执行迁移：

   ```powershell
   npm run db:migrate
   ```

4. 启动前后端：

   ```powershell
   npm run dev
   ```

5. 打开 `http://localhost:3000`。后端健康检查地址为 `http://localhost:3100/api/health`。

## 测试

接口测试使用真实 PostgreSQL，并创建和清理隔离的测试账号：

```powershell
npm run test:api
```

页面测试会真实执行注册、登录、创建项目、访问 8 个流程节点、保存每一步提示词、创建生成任务、退出和重新登录。运行前需要先启动前后端，并确保本机安装 Chrome：

```powershell
npm run test:e2e
```

完整校验：

```powershell
npm run typecheck
npm run build
```

## 真实接口范围

- 注册、登录和 JWT 鉴权
- 项目创建、列表和详情
- 8 个步骤的状态、依赖和解锁
- 从磁盘读取短篇小说 Skill
- 按项目、步骤保存提示词补充内容及版本
- 创建、查询、停止 DeepSeek 生成任务
- 外层 JSON 响应协议校验和一次结构修复
- 候选稿版本化、用户确认和下一步解锁

当前本地版本有意不接 Redis。部署到多实例或生成任务量显著增加时，再将进程内任务执行替换为 Redis 队列，接口协议无需改变。
