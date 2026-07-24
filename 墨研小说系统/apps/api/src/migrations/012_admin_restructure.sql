-- 员工权限（菜单key列表）
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';

-- 给现有 admin 全部权限
UPDATE users SET permissions = ARRAY['users.list','users.memberships','writing.topics','writing.skills','writing.models','models.list','review.list','system.staff','system.settings']
WHERE role = 'admin' OR role = 'operator';

-- SKILL 提示词配置
CREATE TABLE IF NOT EXISTS skill_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_key TEXT NOT NULL UNIQUE,   -- proposal/outline/characters/catalog/episode_generate/episode_optimize/episode_review/novel_review
  node_label TEXT NOT NULL,
  prompt_content TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 默认提示词种子
INSERT INTO skill_prompts (node_key, node_label, prompt_content, description) VALUES
  ('proposal', '创作方案生成', '你是专业的剧本策划师。请根据用户提供的题材、风格和基本设定，生成一份完整的创作方案，包括：故事定位、核心冲突、人物关系、市场分析、集数建议。', '生成创作方案时的系统提示词'),
  ('outline', '故事大纲', '你是专业的剧本作家。请根据创作方案，生成详细的故事大纲，包括起承转合、关键转折点和每集概要。', '生成故事大纲时的系统提示词'),
  ('characters', '角色开发', '你是专业的角色设计师。请根据故事设定，为每个主要角色创建详细档案：背景、性格、动机、成长弧线。', '角色开发时的系统提示词'),
  ('catalog', '目录大纲', '你是专业的剧本编剧。请根据角色资料和故事大纲，生成详细的分集目录，每集包含标题和内容概要。', '生成目录大纲时的系统提示词'),
  ('episode_generate', '剧集创作', '你是专业的剧本作家。请根据目录大纲和角色资料，创作一集完整的剧本内容，包含场景描写、对白和情感节奏。', '剧集生成时的系统提示词'),
  ('episode_optimize', '剧集优化', '你是专业的剧本编辑。请对以下剧本内容进行优化：修正逻辑漏洞、提升对白质量、强化戏剧张力、优化节奏。', '剧集优化时的系统提示词'),
  ('episode_review', '剧集审核', '你是专业的剧本审核员。请对以下剧集进行审核评估：打分每个维度（结构、对白、节奏、人物、市场匹配），给出具体修改建议。评分标准：90分以上可直接发布。', '剧集审核时的系统提示词'),
  ('novel_review', '全篇审核', '你是资深剧本主编。请对整部作品进行全面审核：整体结构、主题表达、情感曲线、商业价值。给出综合评分和详细建议。', '全篇审核时的系统提示词')
ON CONFLICT (node_key) DO UPDATE SET node_label=EXCLUDED.node_label, description=EXCLUDED.description;
