# 短篇小说生成

基于 `oh-story` 产品文档搭建的 Web 端 AI 短篇小说写作平台 MVP。

## 当前内容

- React + TypeScript + Vite 前端
- Ant Design 工作台界面
- 四节点写作流程：定题材、核心框架、小节大纲、正文写作
- 作品集、发现、设置、管理员提示词管理页面
- FastAPI 后端骨架，包含小说、节点生成、确认、对话修改、正文流式输出、评审、管理员提示词接口
- 目前生成内容使用模拟数据，接口形态按产品文档预留

## 前端启动

```bash
npm install
npm run dev
```

默认地址：

```text
http://localhost:5173
```

## 前端构建

```bash
npm run build
```

## 后端启动

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

后端健康检查：

```text
http://localhost:8000/api/v1/health
```

## 后续接入点

- 将 `backend/app/main.py` 的内存数据替换为 PostgreSQL + Redis
- 将模拟 SSE 替换为 DeepSeek 流式调用
- 接入用户登录、JWT、模型配置加密存储
- 将管理员提示词默认内容从 `oh-story` skill 文件初始化到数据库
