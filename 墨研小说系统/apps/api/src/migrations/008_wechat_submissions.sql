-- ====== 8. 微信绑定 ======
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_openid TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_unionid TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_nickname TEXT;
CREATE INDEX IF NOT EXISTS idx_users_wechat ON users(wechat_openid);

-- ====== 7. 审稿模型配置 ======
INSERT INTO system_settings (key, value, updated_at) VALUES
  ('review_model', '"gpt-4o"'::jsonb, now()),
  ('review_base_url', '"https://api.openai.com/v1"'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

-- ====== 3. 投稿平台 ======
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  project_id UUID,
  title TEXT NOT NULL,
  drama_type TEXT NOT NULL,
  style_type TEXT NOT NULL,
  content TEXT NOT NULL,
  self_review_score INT,          -- 自审评分
  self_review_report TEXT,         -- 自审报告
  self_review_recommend BOOLEAN,   -- 是否推荐送审
  status TEXT NOT NULL DEFAULT 'draft',  -- draft/pending/reviewing/approved/rejected/withdrawn
  reviewer_id UUID REFERENCES users(id),
  reviewer_comment TEXT,           -- 审核意见
  reviewer_score INT,              -- 审核评分
  reviewer_decision TEXT,          -- approved / rejected
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id, created_at);

-- 投稿配置表：支持的剧型和风格类型
CREATE TABLE IF NOT EXISTS submission_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,  -- drama_type / style_type
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category, value)
);

INSERT INTO submission_configs (category, value, label, sort_order) VALUES
  ('drama_type', 'short_drama', '短剧', 1),
  ('drama_type', 'comic_drama', '漫剧', 2),
  ('drama_type', 'short_novel', '短篇小说', 3)
ON CONFLICT (category, value) DO NOTHING;

INSERT INTO submission_configs (category, value, label, sort_order) VALUES
  ('style_type', 'domestic', '国内下沉剧', 1),
  ('style_type', 'overseas_live', '海外仿真人', 2),
  ('style_type', 'overseas_ai', '海外AI剧本', 3)
ON CONFLICT (category, value) DO NOTHING;
