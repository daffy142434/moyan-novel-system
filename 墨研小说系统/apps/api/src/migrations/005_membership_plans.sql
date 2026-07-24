CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_monthly NUMERIC NOT NULL DEFAULT 0,
  price_yearly NUMERIC NOT NULL DEFAULT 0,
  credits_monthly INT NOT NULL DEFAULT 0,
  features TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  period TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID,
  plan_id UUID REFERENCES subscription_plans(id),
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'mock',
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE membership_accounts ADD COLUMN IF NOT EXISTS subscription_id UUID;
ALTER TABLE membership_accounts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE membership_accounts ADD COLUMN IF NOT EXISTS monthly_credits INT DEFAULT 0;
ALTER TABLE membership_accounts ADD COLUMN IF NOT EXISTS credits_used_this_month INT DEFAULT 0;

INSERT INTO subscription_plans (tier, name, price_monthly, price_yearly, credits_monthly, features) VALUES
  ('free', '免费版', 0, 0, 100, ARRAY['基础模型访问', '最多3个项目', '每日50次AI生成']),
  ('plus', '专业版', 29, 239, 2000, ARRAY['全部模型', '自定义模型Key', '无限项目', '优先生成队列', '每日500次AI生成']),
  ('max', '旗舰版', 79, 639, 10000, ARRAY['Plus全部功能', '专属高性能模型', '更快响应速度', 'API访问权限', '无限制AI生成', '优先技术支持'])
ON CONFLICT (tier) DO UPDATE SET
  name=EXCLUDED.name, price_monthly=EXCLUDED.price_monthly, price_yearly=EXCLUDED.price_yearly,
  credits_monthly=EXCLUDED.credits_monthly, features=EXCLUDED.features;

INSERT INTO membership_accounts (user_id, plan, credit_balance, monthly_credits, credits_used_this_month)
SELECT id, 'free', 100, 100, 0 FROM users u
WHERE NOT EXISTS (SELECT 1 FROM membership_accounts WHERE user_id = u.id);
