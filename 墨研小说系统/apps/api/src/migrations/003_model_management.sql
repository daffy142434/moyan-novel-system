-- 模型管理系统迁移
-- 运行: psql -U postgres -d moyan -f apps/api/src/migrations/003_model_management.sql

-- 系统级模型表
CREATE TABLE IF NOT EXISTS system_models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  provider    TEXT NOT NULL DEFAULT 'deepseek',
  model_id    TEXT NOT NULL,
  base_url    TEXT NOT NULL,
  api_key     TEXT,
  is_enabled  BOOLEAN NOT NULL DEFAULT true,
  priority    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 用户自定义模型表
CREATE TABLE IF NOT EXISTS user_models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  provider    TEXT NOT NULL DEFAULT 'custom',
  model_id    TEXT NOT NULL,
  base_url    TEXT NOT NULL,
  api_key     TEXT NOT NULL,
  is_enabled  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, model_id)
);

-- 管理员操作日志
CREATE TABLE IF NOT EXISTS admin_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 系统配置 KV
CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 用户添加 is_admin 字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false;

-- 预设管理员（qa@moyan.dev）
UPDATE users SET is_admin = true WHERE email = 'qa@moyan.dev';

-- 预设系统模型
INSERT INTO system_models (name, provider, model_id, base_url, priority) VALUES
  ('DeepSeek V4 Pro', 'deepseek', 'deepseek-chat', 'https://api.deepseek.com/v1', 10),
  ('DeepSeek V4 Flash', 'deepseek', 'deepseek-chat', 'https://api.deepseek.com/v1', 5),
  ('GPT-4o', 'openai', 'gpt-4o', 'https://api.openai.com/v1', 8),
  ('Kimi Moonshot', 'moonshot', 'moonshot-v1-8k', 'https://api.moonshot.cn/v1', 6)
ON CONFLICT DO NOTHING;

-- 默认系统配置
INSERT INTO system_settings (key, value) VALUES
  ('registration_open', 'true'),
  ('default_credits', '100'),
  ('tone_required', 'true')
ON CONFLICT (key) DO NOTHING;
