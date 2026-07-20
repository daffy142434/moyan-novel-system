# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

Codex 是一套 **AI 驱动的短篇故事（短片小说）生产系统**。目标不是让单个模型偶然写出一篇好故事，而是把创作方法、审美标准、流程、输入输出协议、素材库、评审机制和模型编排方式固化下来，让不同大模型都能按同一套规则协作。

## 系统架构

### 四层架构

1. **审美层** — 定义什么是好故事（`01-style-bible.md`），包括：故事优先于句子、冲突优先于设定、行动优先于解释、潜台词优先于直说、改稿优先于一次生成。

2. **流程层** — 10 步创作流水线（`02-production-pipeline.md`）：
   - 需求输入 → 创意发散 → 方案筛选 → 故事规格 → 分场大纲 → 正文初稿 → 编辑评审 → 重写 → 终稿审校 → 记忆沉淀

3. **协作层** — 多角色分工（`04-role-prompts.md`）：
   - `producer`：判断项目定位和受众
   - `story_architect`：设计结构、冲突、反转
   - `writer`：写正文
   - `editor`：批评、提出改稿方案
   - `style_guardian`：统一语言风格
   - `continuity_checker`：检查设定、人物和时间线

4. **协议层** — 统一输入输出格式（`06-model-adapter.md`）

### 成熟度分级

- **L1（当前）**：文档辅助，人工复制文档和模板给模型
- **L2**：半自动工作流，脚本调用模型并保存版本
- **L3**：多模型创作台，自动路由、评审、重试
- **L4**：数据驱动，使用历史评分和 A/B 测试优化
- **L5**：生产级 IP 系统，支持系列世界观和团队协作

## 文档结构

所有文档在 `docs/novel-production-system/` 下：

| # | 文件 | 用途 |
|---|------|------|
| 00 | `00-system-overview.md` | 系统总览、架构、工作流 |
| 01 | `01-style-bible.md` | 统一审美、文风、禁忌 |
| 02 | `02-production-pipeline.md` | 从选题到终稿的完整步骤 |
| 03 | `03-story-spec.md` | 故事项目结构化信息 |
| 04 | `04-role-prompts.md` | 各模型角色提示词 |
| 05 | `05-editorial-rubric.md` | 评审量表 |
| 06 | `06-model-adapter.md` | 多模型输入输出约束 |
| 07 | `07-memory-knowledge-base.md` | 记忆与知识库 |
| 08 | `08-reference-ingestion.md` | 素材摄取与风格学习 |
| 09 | `09-orchestration-workflows.md` | 多模型流水线编排 |
| 10 | `10-quality-gates.md` | 质量门禁和阻断条件 |
| 11 | `11-data-model.md` | 数据结构定义 |
| 12 | `12-genre-modules.md` | 悬疑/现实/科幻等类型规则 |
| 13 | `13-implementation-roadmap.md` | 工程化路线图 |
| 14 | `14-context-assembly.md` | 上下文装配规则 |
| — | `xuanhuan-rule-tales-execution-spec.md` | 玄幻规则故事执行规格 |
| — | `templates/` | YAML/JSON 模板（story-brief, scene-outline, review, model-request 等） |
| — | `memory/` | 记忆库（characters, worlds, projects, finished-stories） |

## 核心数据结构（11-data-model.md）

- `StoryProject` — 创作项目
- `StoryBrief` — 用户需求和创作约束
- `StorySpec` — 所有模型共享的故事核心规格
- `SceneOutline` — 分场结构
- `DraftVersion` — 正文版本
- `ReviewReport` — 编辑评审
- `RewritePlan` — 重写计划
- `MemoryPatch` — 可写回记忆库的增量

## 推荐创作流程

每次创作不要直接让模型写正文，标准顺序：

1. 填写 `templates/story-brief.yaml`
2. 读取 `01-style-bible.md` 和 `12-genre-modules.md`
3. 由 `producer` 角色判断项目定位
4. 由 `story_architect` 产出 3-5 个方案
5. 选定方案后生成 `StorySpec`
6. 进入分场 → 大纲 → 正文 → 编辑 → 重写 → 语言打磨
7. 通过质量门禁后定稿
8. 把可复用经验写入记忆库

## 最小可用流程（5 步）

1. 用 `story-brief.yaml` 写需求
2. 让模型生成 5 个故事方案
3. 选一个方案扩展成完整故事规格
4. 写初稿
5. 用评审量表打分并重写

## 命名规范

- 文档用数字前缀排序：`00-`, `01-`, `02-` 等
- 模板用 kebab-case：`story-brief.yaml`, `scene-outline.yaml`
- 角色名使用 snake_case：`story_architect`, `style_guardian`
