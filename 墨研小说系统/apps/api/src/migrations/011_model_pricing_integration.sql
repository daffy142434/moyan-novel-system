-- system_models 增加价格字段（单位：元/千token）
ALTER TABLE system_models ADD COLUMN IF NOT EXISTS price_per_1k_input NUMERIC NOT NULL DEFAULT 0.001;
ALTER TABLE system_models ADD COLUMN IF NOT EXISTS price_per_1k_output NUMERIC NOT NULL DEFAULT 0.002;
ALTER TABLE system_models ADD COLUMN IF NOT EXISTS model_type TEXT DEFAULT 'text';

-- 给现有模型设置价格
UPDATE system_models SET price_per_1k_input=0.001, price_per_1k_output=0.002, model_type='text' WHERE provider='deepseek';
UPDATE system_models SET price_per_1k_input=0.005, price_per_1k_output=0.015, model_type='text' WHERE provider='openai' OR provider='gpt';

-- 也可以干掉独立 model_pricing 表（数据已迁移到 system_models）
-- DROP TABLE IF EXISTS model_pricing;
