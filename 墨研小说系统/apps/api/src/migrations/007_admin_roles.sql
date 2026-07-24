-- 添加角色字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- 现有管理员升级为系统管理员
UPDATE users SET role = 'admin' WHERE is_admin = true;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
