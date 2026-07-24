CREATE TABLE IF NOT EXISTS product_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL,
  category TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  recommendation INT NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT '{}',
  channel TEXT,
  compatible_modes TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_type, category, value)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_product_choices_lookup ON product_choices(product_type, category, is_active);

-- Seed data: short_drama modes
INSERT INTO product_choices (product_type, category, value, label, description, recommendation, tags, channel) VALUES
  ('short_drama', 'mode', 'domestic', '国内下沉剧', '国内平台、中文、接地气的小人物成长与强节奏', 5, ARRAY['推荐'], NULL),
  ('short_drama', 'mode', 'overseas_live', '海外仿真人原创', '海外真人拍摄，使用本地化人物与可拍场景', 4, ARRAY['热门'], NULL),
  ('short_drama', 'mode', 'overseas_ai', '海外 AI 剧本', '面向 AI 漫或仿真人制作，视觉自由度更高', 3, ARRAY[]::text[], NULL)
ON CONFLICT (product_type, category, value) DO UPDATE SET label=EXCLUDED.label, description=EXCLUDED.description, recommendation=EXCLUDED.recommendation, tags=EXCLUDED.tags;

-- short_drama genres  
INSERT INTO product_choices (product_type, category, value, label, description, recommendation, tags, channel, compatible_modes) VALUES
  ('short_drama', 'genre', '霸总', '霸道总裁', '都市、职场或豪门背景的强势男主与女主之间的情感博弈', 5, ARRAY['推荐', '爆款'], 'female', ARRAY['domestic']),
  ('short_drama', 'genre', '战神', '战神回归', '退役或隐藏实力的军人/强者回归都市掀起波澜', 5, ARRAY['推荐', '爆款'], 'male', ARRAY['domestic']),
  ('short_drama', 'genre', '逆袭', '逆袭人生', '底层小人物通过努力、机遇或重生实现命运反转', 4, ARRAY['推荐'], NULL, ARRAY['domestic']),
  ('short_drama', 'genre', '甜宠', '甜蜜宠妻', '高甜恋爱、契约婚姻或追妻火葬场的浪漫故事', 4, ARRAY['热门'], 'female', ARRAY['domestic']),
  ('short_drama', 'genre', '重生', '重生复仇', '带着前世记忆重生，逆天改命、有仇报仇', 4, ARRAY['热门'], 'female', ARRAY['domestic']),
  ('short_drama', 'genre', '萌宝', '萌宝归来', '带球跑、天才萌宝帮妈咪追爸的温馨甜爽故事', 3, ARRAY[]::text[], 'female', ARRAY['domestic']),
  ('short_drama', 'genre', '古装', '古装权谋', '古代宫廷或江湖背景的权谋、商战与爱情', 3, ARRAY[]::text[], NULL, ARRAY['domestic']),
  ('short_drama', 'genre', '悬疑', '悬疑惊悚', '密室、连环案件或心理悬疑的紧张故事', 3, ARRAY[]::text[], NULL, ARRAY['domestic','overseas_live']),
  ('short_drama', 'genre', '末日', '末日生存', '丧尸、天灾或废土世界的生存与人性的较量', 2, ARRAY[]::text[], 'male', ARRAY['domestic','overseas_ai']),
  ('short_drama', 'genre', '都市', '都市情感', '现代都市中的爱情、友情与成长故事', 3, ARRAY[]::text[], NULL, ARRAY['overseas_live']),
  ('short_drama', 'genre', '奇幻', '奇幻冒险', '魔法、异能或异世界的冒险旅程', 2, ARRAY[]::text[], NULL, ARRAY['overseas_ai']),
  ('short_drama', 'genre', '喜剧', '轻松喜剧', '搞笑、反差和密集笑点的轻松故事', 2, ARRAY[]::text[], NULL, ARRAY['domestic','overseas_live']),
  ('short_drama', 'genre', '暗黑', '暗黑复仇', '压迫感、灰度抉择与暗黑复仇的强烈故事', 2, ARRAY[]::text[], NULL, ARRAY['overseas_ai'])
ON CONFLICT (product_type, category, value) DO UPDATE SET label=EXCLUDED.label, description=EXCLUDED.description, recommendation=EXCLUDED.recommendation, tags=EXCLUDED.tags, channel=EXCLUDED.channel, compatible_modes=EXCLUDED.compatible_modes;

-- short_drama tones
INSERT INTO product_choices (product_type, category, value, label, description, recommendation, tags) VALUES
  ('short_drama', 'tone', '爽燃', '爽燃', '快节奏、高压冲突和连续回报', 5, ARRAY['推荐','爆款']),
  ('short_drama', 'tone', '甜虐', '甜虐', '甜蜜与情感伤害交替推进', 4, ARRAY['推荐']),
  ('short_drama', 'tone', '温情', '温情', '家庭、成长和情感治愈', 3, ARRAY['热门']),
  ('short_drama', 'tone', '暗黑', '暗黑', '压迫感、复仇与灰度抉择', 3, ARRAY[]::text[]),
  ('short_drama', 'tone', '搞笑', '搞笑', '轻松、反差和密集笑点', 3, ARRAY[]::text[])
ON CONFLICT (product_type, category, value) DO UPDATE SET label=EXCLUDED.label, description=EXCLUDED.description, recommendation=EXCLUDED.recommendation, tags=EXCLUDED.tags;

-- comic_drama modes
INSERT INTO product_choices (product_type, category, value, label, description, recommendation, tags) VALUES
  ('comic_drama', 'mode', 'domestic', '国内漫剧', '面向国内平台的漫画改编短剧', 5, ARRAY['推荐']),
  ('comic_drama', 'mode', 'overseas_ai', '出海漫剧', '面向海外市场的AI漫画剧', 4, ARRAY['热门'])
ON CONFLICT (product_type, category, value) DO UPDATE SET label=EXCLUDED.label, description=EXCLUDED.description, recommendation=EXCLUDED.recommendation, tags=EXCLUDED.tags;

-- comic_drama genres
INSERT INTO product_choices (product_type, category, value, label, description, recommendation, tags, channel) VALUES
  ('comic_drama', 'genre', '霸总', '霸道总裁', '都市豪门情感博弈', 5, ARRAY['推荐','爆款'], 'female'),
  ('comic_drama', 'genre', '战神', '战神回归', '强者回归都市', 5, ARRAY['推荐','爆款'], 'male'),
  ('comic_drama', 'genre', '逆袭', '逆袭人生', '底层逆袭故事', 4, ARRAY['推荐'], NULL),
  ('comic_drama', 'genre', '甜宠', '甜蜜宠妻', '高甜恋爱故事', 4, ARRAY['热门'], 'female'),
  ('comic_drama', 'genre', '重生', '重生复仇', '重生改变命运', 4, ARRAY['热门'], 'female'),
  ('comic_drama', 'genre', '奇幻', '奇幻冒险', '魔法异世界冒险', 3, ARRAY[]::text[], NULL),
  ('comic_drama', 'genre', '悬疑', '悬疑推理', '案件与心理悬疑', 3, ARRAY[]::text[], NULL)
ON CONFLICT (product_type, category, value) DO UPDATE SET label=EXCLUDED.label, description=EXCLUDED.description, recommendation=EXCLUDED.recommendation, tags=EXCLUDED.tags, channel=EXCLUDED.channel;

-- comic_drama tones (same as short_drama)
INSERT INTO product_choices (product_type, category, value, label, description, recommendation, tags) VALUES
  ('comic_drama', 'tone', '爽燃', '爽燃', '快节奏与连续回报', 5, ARRAY['推荐']),
  ('comic_drama', 'tone', '甜虐', '甜虐', '甜蜜与伤害交替', 4, ARRAY['推荐']),
  ('comic_drama', 'tone', '温情', '温情', '家庭成长治愈', 3, ARRAY[]::text[]),
  ('comic_drama', 'tone', '搞笑', '搞笑', '轻松反差笑点', 3, ARRAY[]::text[])
ON CONFLICT (product_type, category, value) DO UPDATE SET label=EXCLUDED.label, description=EXCLUDED.description, recommendation=EXCLUDED.recommendation, tags=EXCLUDED.tags;

-- shared: audiences, endings, languages
INSERT INTO product_choices (product_type, category, value, label, description, recommendation) VALUES
  ('*', 'audience', 'male', '男频', '强调实力、逆袭和高密度爽点', 2),
  ('*', 'audience', 'female', '女频', '强调情绪拉扯、关系与身份反转', 2),
  ('*', 'audience', 'all', '全年龄', '兼顾温情、正义与大众共鸣', 2),
  ('*', 'ending', '圆满', '圆满', '主要冲突解决并给出情感回报', 1),
  ('*', 'ending', '开放', '开放', '保留想象与讨论空间', 2),
  ('*', 'ending', '反转', '反转', '结尾重新解释前文信息', 2),
  ('*', 'ending', '悲情', '悲情', '以代价和遗憾形成余味', 2),
  ('*', 'language', 'zh-CN', '中文', '输出中文剧本', 1),
  ('*', 'language', 'en', '英文', '输出英文剧本并执行文化适配', 2)
ON CONFLICT (product_type, category, value) DO UPDATE SET label=EXCLUDED.label, description=EXCLUDED.description, recommendation=EXCLUDED.recommendation;
