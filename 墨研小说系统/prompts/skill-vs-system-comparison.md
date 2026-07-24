# 短剧写作 Skill vs 系统 提示词对比报告

> 生成时间：2026-07-22 13:10
> 主题：海外仿真人原创 · 霸道总裁 · 50集
> 作品：霸总的契约新娘

---

## 流程对照

| # | Skill 流程 | 系统实现 | 状态 |
|---|-----------|---------|------|
| 1 | `/开始` → 确认制作模式 | 前端选择页面（mode step） | 替代 |
| 2 | 题材选择 | 前端选择页面（genre step） | 替代 |
| 3 | 补充设定 | 前端选择页面（settings step） | 替代 |
| 4 | `/创作方案` → 生成方案 | `generateProposal` (DeepSeek) | ✅ |
| 5 | `/角色开发` | `generateBuild:characters` (手动填入) | ⏭ |
| 6 | `/目录` | `generateBuild:catalog` (手动填入) | ⏭ |
| 7 | `/分集` → 第1集 | `generateEpisode` (DeepSeek) | ✅ |
| 8 | `/自检` | `reviewEpisode` (DeepSeek) | ✅ |

---

## 阶段 1：创作方案（Proposal）

### Skill 要求
从 SKILL.md "创作方案生成" 章节：
- **输入**: 题材、模式、受众、基调、结局、集数、特殊要求
- **必须包含**: 基础信息(3备选剧名)、时空背景、故事核心、叙事结构(三幕)、节奏规划(付费卡点/情绪波形)、结局设计、爽点矩阵
- **参考**: rhythm-design.md + conflict-design.md + opening-hooks.md

### 系统实际调用

- **模型**: deepseek-v4-pro
- **System Prompt 长度**: 19,436 字符
- **User Prompt 长度**: 232 字符
- **返回长度**: 2,228 字符

#### System Prompt（关键部分）
```
你是墨研创作方案引擎。请根据创作规则和用户选择生成方案。
只返回 JSON：{"content":"完整Markdown方案","summary":"100字内摘要","titles":["标题1","标题2","标题3"]}。

【专业创作规则】
[short-drama/SKILL.md 全文 + genre-guide.md + conflict-design.md + rhythm-design.md + opening-hooks.md]
```

#### User Prompt
```json
{"selections":{"mode":"overseas_live","tone":["爽燃","甜虐"],"genre":"霸道总裁","ending":"圆满","audience":"female","language":"zh-CN","episodeCount":50,"visualStyle":"real_life"},"user_instruction":"","novelist_type":"creative_proposal"}
```

### 差异分析

| 维度 | Skill 预期 | 系统实现 | 差异 |
|------|----------|---------|------|
| 剧名备选 | 3个备选 | 3个 titleOptions | ✅ 一致 |
| 基础信息 | 受众、语言风格 | selections 包含全部 | ✅ 一致 |
| 时空背景 | 时代/地点/社会 | SKILL.md 规则指导模型生成 | ⚠️ 依赖模型 |
| 节奏规划 | 付费卡点/情绪波形 | SKILL.md 规则指导 | ⚠️ 依赖模型 |
| 爽点矩阵 | 全剧爽点分布 | conflict-design.md | ⚠️ 依赖模型 |
| tone多选 | skill只选一个基调 | 系统支持多选 | ⚠️ 系统向前兼容 |

---

## 阶段 2：分集撰写第1集（Episode）

### Skill 要求
从 SKILL.md "剧本格式" + episode-writing.md：
- **前置读取**: 创作方案 + 角色档案 + 分集目录 + 最近2-3集剧本
- **格式**: 海外剧格式（集数-场次 地点 日/夜 内/外）
- **字数**: 600-700字
- **结构**: 开场30秒引爆、承接上集(第1集除外)、至少2爽点、结尾钩子
- **台词**: 口语化、单句≤30字、角色辨识度、无AI味

### 系统实际调用

- **模型**: deepseek-v4-pro
- **System Prompt 长度**: 20,317 字符
- **User Prompt 长度**: 3,128 字符
- **返回长度**: 1,471 字符

#### System Prompt（关键部分）
```
生成第1集剧本。严格按照以下所有要求撰写：

【硬性指标】
- 每集600-700字，必须达标
- 每集3-5个场次
- 对话占比≥70%，用对话驱动剧情

【情节结构】
- 开场30秒引爆：前3行内必须出现冲突、压迫或危机，不铺背景
- 承接上集：开头必须自然回应上集结尾的钩子（见prev_ending）
- 本集围绕一个核心冲突展开
- 至少2个爽点或反转
- 结尾留钩子：最后一场必须留下强烈悬念

【第1集特殊要求】第一个场次的第一行就要抓人。30秒内建立主角困境和核心矛盾。
本集结束时观众必须知道：主角是谁、他面临什么问题、为什么要继续看。最后留超强钩子暗示主角不简单。

【格式规范】海外剧用英文场景头...

【风格要求】快节奏第一...
```

#### User Prompt（结构）
```json
{
  "productType": "short_drama",
  "productionMode": "overseas_live",
  "genre": "霸道总裁",
  "tone": "爽燃",          ← 多选tone被转为首个值！
  "title": "霸总的契约新娘",
  "episodeCount": 50,
  "episode_outline": "第1集目录要点",
  "build": [角色设定全文, 创作方案全文],
  "prev_ending": "",
  "recent_episodes": [],
  "instruction": "",
  "framework": "short-drama-episode"
}
```

### 差异分析

| 维度 | Skill 预期 | 系统实现 | 差异 |
|------|----------|---------|------|
| **前置读取** | 读取创作方案+角色+目录+前2-3集 | build数组传了全部 | ✅ 上下文完整 |
| **上集了解** | 需要了解上集结尾 | prev_ending传了(第1集为空) | ✅ |
| **目录大纲** | 必须读取分集目录 | episode_outline包含 | ✅ |
| **格式要求** | 海外剧英文场景头 | System Prompt明确标注 | ✅ |
| **字数要求** | 600-700字 | System Prompt第一行写明 | ✅ |
| **tone多选** | skill只选一个基调 | tone字段只有第一个值 | 🔴 **丢失了第二个基调** |
| **第1集特殊规则** | 第一时间引爆 | 单独prompt写了 | ✅ |
| **对话占比** | 对话驱动 | System Prompt写明 | ✅ |
| **台词≤30字** | skill要求 | System Prompt写明 | ✅ |
| **爽点数量** | ≥2个 | System Prompt写明 | ✅ |

---

## 阶段 3：自检（Review）

### Skill 要求
从 drama-review/SKILL.md + episode-writing.md "自检清单"：
- **审核前确认**: 制作模式、审核阶段、审核范围
- **十大维度**: 材料完整性、格式合规、题材合规、节奏、逻辑连贯、上下文衔接、人物一致、台词自然度、动作画面、AI生成痕迹
- **自检清单**: 节奏、爽点、台词、格式、连贯性、合规

### 系统实际调用

- **模型**: deepseek-v4-pro
- **System Prompt 长度**: 3,626 字符
- **User Prompt 长度**: 1,548 字符
- **返回长度**: 295 字符（非常短！）

#### System Prompt（关键部分）
```
严格按照【专业创作规则】对当前集剧本执行审核。每次独立判断，不参考之前评分。

输出格式：只返回 JSON，不返回 Markdown 或其他文字。
{"score":0到100（十分制换算）,"summary":"审核总结","suggestions":["具体建议（指出位置和修改方向）"],"dimensions":{"维度名":得分,...}}

其中 dimensions 使用【专业创作规则】中定义的审核维度作为 key。

【专业创作规则】
[drama-review SKILL.md 全文]
```

#### User Prompt
```json
{"productionMode":"overseas_live","reviewStage":"正文剧本",
 "project":{"type":"short_drama","mode":"overseas_live","genre":"霸道总裁"},
 "episode":{"number":1,"title":"...","outlineSummary":"...","content":"...","contentVersion":1}}
```

### 差异分析

| 维度 | Skill 预期 | 系统实现 | 差异 |
|------|----------|---------|------|
| **审核前确认** | 确认模式/阶段/范围 | productionMode + reviewStage | ✅ 自动确认 |
| **十维审核** | 逐项检查 | SKILL.md原文加载 | ✅ |
| **字数检查** | 600-700字 | 模型按SKILL.md规则判断 | ✅ |
| **审核报告格式** | 输出审核报告.md(含必改项/建议项/通过项) | JSON格式（score+summary+suggestions+dimensions） | ⚠️ 格式简化 |
| **分级输出** | 必改项🔴/建议项🟡/通过项🟢 | 仅score+suggestions | 🔴 **缺失分级** |
| **逐集明细** | 每集维度逐项标注 | dimensions用skill维度名 | ⚠️ 格式不同 |
| **返回长度** | 预期详细的逐集报告 | 仅295字符 | 🔴 **过于简略** |

---

## 核心发现

### 1. Tone 多选丢失
系统支持了前端多选tone，但传到模型时只用了第一个值。这会导致模型无法理解"爽燃+甜虐"的组合风格。

### 2. 自检格式简化
drama-review skill 设计的分级报告（必改/建议/通过）在 JSON 格式下全部丢失。模型只返回了 score + summary + suggestions，失去了分级筛选的指导价值。

### 3. 自检回复过短
review 只返回 295 字符，而 proposal 返回了 2228 字符。说明 review 的 system prompt 没有明确要求"详细"的输出。drama-review skill 中期望的"逐集检查明细"在 JSON 格式下被模型省略。

### 4. Skill 材料加载完全
系统确实加载了完整的 SKILL.md + 参考资料。proposal 阶段加载了 19436 字符的规则，episode 阶段加载了 20317 字符的规则。这与 skill 流程要求的"读取对应文件"一致。

### 5. 上下文传递完整
从 episode writing 的 user prompt 看，系统正确传递了：
- 角色设定（build artifacts）
- 创作方案
- 目录大纲（episode_outline）
- 前集结尾（prev_ending）
这与 skill 要求的"前置读取"一致。

### 6. 缺失的前置读取
Skill 要求"分集撰写前读取最近2-3集剧本"，系统传了 prev_ending（最后300字）+ recent_episodes（已确认集的最后400字）。这个量化截断与skill的"读取完整剧本"有差距，但已满足"承接上集"的基本需求。
