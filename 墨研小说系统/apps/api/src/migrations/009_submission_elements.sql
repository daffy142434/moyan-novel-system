-- 送审增强：三要素 + 机检流程
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS elements TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS machine_review_score INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS machine_review_report TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS machine_review_recommend BOOLEAN;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS episode_count INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS episode_contents TEXT[] DEFAULT '{}';

-- 状态流转: draft → elements_packaged → machine_reviewing → machine_reviewed → pending → reviewing → approved/rejected
-- 简化: draft → pending (已送审待审核) → reviewing (审核中) → approved/rejected
-- 其中 pending 之前的步骤在前端弹窗中完成
