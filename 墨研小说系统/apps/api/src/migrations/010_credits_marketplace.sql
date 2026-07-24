-- 积分交易记录
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,        -- purchase / monthly_reset / usage / gift / refund
  amount NUMERIC NOT NULL,   -- 正=充值/赠送, 负=消费
  balance_after NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id, created_at);

-- 模型定价（模型广场）
CREATE TABLE IF NOT EXISTS model_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_type TEXT NOT NULL DEFAULT 'text',   -- text / image / video / audio
  price_per_1k_input NUMERIC NOT NULL DEFAULT 0,
  price_per_1k_output NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 预设模型广场数据
INSERT INTO model_pricing (model_name, provider, model_type, price_per_1k_input, price_per_1k_output, description, sort_order) VALUES
  ('DeepSeek V4 Pro', 'DeepSeek', 'text', 0.001, 0.002, '默认推荐模型，性价比极高', 1),
  ('GPT-4o', 'OpenAI', 'text', 0.005, 0.015, 'OpenAI 旗舰模型，审稿专用', 2),
  ('Claude 4 Sonnet', 'Anthropic', 'text', 0.003, 0.012, 'Anthropic 主力模型，文学创作强', 3),
  ('Gemini 2.5 Pro', 'Google', 'text', 0.0035, 0.0105, 'Google 最新模型，多语言支持', 4),
  ('Qwen3-Max', '阿里云', 'text', 0.002, 0.004, '通义千问旗舰版', 5),
  ('GLM-4-Plus', '智谱', 'text', 0.002, 0.004, '智谱清言旗舰版', 6),
  ('DeepSeek V3', 'DeepSeek', 'text', 0.0005, 0.001, '轻量推理模型', 7)
ON CONFLICT DO NOTHING;
