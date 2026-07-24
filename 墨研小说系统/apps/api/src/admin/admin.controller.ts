import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Req, UseGuards, BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin-auth.guard';
import { DatabaseService } from '../database/database.service';
import { AuthService } from '../auth/auth.service';
import bcrypt from 'bcryptjs';

@Controller('admin')
export class AdminController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  /** 登录：仅 role=admin|operator 可登，返回权限 + 是否需要改密 */
  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const result = await this.auth.login({ email: body.email, password: body.password });
    const tokenPayload = this.auth.verify(result.accessToken);
    const r = await this.db.query('SELECT role, permissions, password_change_required FROM users WHERE id=$1', [tokenPayload.id]);
    const role = r.rows[0]?.role;
    if (role !== 'admin' && role !== 'operator' && role !== 'writer') throw new BadRequestException({ code: 'ADMIN_REQUIRED' });
    return { ...result, role, permissions: r.rows[0]?.permissions || [], passwordChangeRequired: r.rows[0]?.password_change_required || false };
  }

  /** 修改密码 */
  @Post('change-password') @UseGuards(AuthGuard)
  async changePassword(@Req() req: AuthenticatedRequest, @Body() b: { oldPassword: string; newPassword: string }) {
    const user = await this.db.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    if (!await bcrypt.compare(b.oldPassword, user.rows[0].password_hash)) throw new BadRequestException({ code: 'WRONG_PASSWORD', message: '原密码不正确' });
    const hash = await bcrypt.hash(b.newPassword, 12);
    await this.db.query('UPDATE users SET password_hash=$1, password_change_required=false, updated_at=now() WHERE id=$2', [hash, req.user.id]);
    return { ok: true };
  }

  /** 当前用户信息 */
  @Get('me') @UseGuards(AuthGuard) async me(@Req() req: AuthenticatedRequest) {
    const r = await this.db.query('SELECT id, email, display_name, role, permissions, password_change_required FROM users WHERE id=$1', [req.user.id]);
    return r.rows[0] || null;
  }

  /** 仪表盘 */
  @Get('dashboard') @UseGuards(AuthGuard)
  async dashboard() {
    const [uc, tc, mc, tt] = await Promise.all([
      this.db.query('SELECT COUNT(*)::int as c FROM users').then(r => r.rows[0].c),
      this.db.query("SELECT COUNT(*)::int as c FROM model_usage WHERE created_at>=CURRENT_DATE").then(r => r.rows[0].c),
      this.db.query('SELECT COUNT(*)::int as c FROM system_models WHERE is_enabled=true').then(r => r.rows[0].c),
      this.db.query("SELECT COALESCE(SUM(input_tokens+output_tokens)/1000,0)::int as c FROM model_usage WHERE created_at>=CURRENT_DATE").then(r => r.rows[0].c),
    ]);
    return { userCount: uc, todayCalls: tc, activeModels: mc, todayTokens: tt };
  }

  // ====== 员工管理 ======
  @Get('staff') @UseGuards(AdminGuard) async listStaff() {
    return (await this.db.query("SELECT id, email, display_name, role, permissions, is_disabled, password_change_required, created_at FROM users WHERE role IN ('admin','operator','writer') ORDER BY created_at DESC")).rows;
  }

  @Post('staff') @UseGuards(AdminGuard)
  async createStaff(@Body() b: { email: string; displayName?: string; role?: string; permissions?: string[] }) {
    const existing = await this.db.query('SELECT id FROM users WHERE email=$1', [b.email]);
    if (existing.rowCount) throw new BadRequestException({ code: 'EMAIL_EXISTS' });
    const hash = await bcrypt.hash('admin123456', 12);
    const r = await this.db.query(
      `INSERT INTO users (email, password_hash, display_name, role, is_admin, permissions, password_change_required) VALUES ($1,$2,$3,$4,true,$5,true) RETURNING id, email, display_name, role, permissions, created_at`,
      [b.email, hash, b.displayName || '', b.role === 'admin' ? 'admin' : 'operator', b.permissions || []],
    );
    return r.rows[0];
  }

  @Put('staff/:id') @UseGuards(AdminGuard)
  async updateStaff(@Param('id') id: string, @Body() b: { permissions?: string[]; role?: string; is_disabled?: boolean }) {
    const sets: string[] = []; const ps: any[] = []; let i = 1;
    if (b.permissions !== undefined) { sets.push(`permissions=$${i++}`); ps.push(b.permissions); }
    if (b.role !== undefined) { sets.push(`role=$${i++}`); ps.push(b.role); }
    if (b.is_disabled !== undefined) { sets.push(`is_disabled=$${i++}`); ps.push(b.is_disabled); }
    if (!sets.length) throw new BadRequestException('no fields');
    ps.push(id);
    await this.db.query(`UPDATE users SET ${sets.join(',')} WHERE id=$${i}`, ps);
    return { ok: true };
  }

  @Get('menus') @UseGuards(AuthGuard) async availableMenus() {
    return [
      { key: 'users.list', label: '用户管理', parent: '用户管理' },
      { key: 'writing.topics', label: '题材配置', parent: '写作配置' },
      { key: 'writing.skills', label: 'SKILL配置', parent: '写作配置' },
      { key: 'writing.models', label: '模型配置', parent: '写作配置' },
      { key: 'models.list', label: '模型管理', parent: '模型配置' },
      { key: 'review.list', label: '审核列表', parent: '审核管理' },
      { key: 'system.staff', label: '员工管理', parent: '系统管理' },
      { key: 'system.settings', label: '系统配置', parent: '系统管理' },
    ];
  }

  // ====== 用户管理 ======
  @Get('users') @UseGuards(AdminGuard) async listUsers(@Query('page') p = 1, @Query('search') s = '') {
    const o = (p - 1) * 20;
    // C端用户 + 有C端行为的员工（有membership_accounts记录即为C端活跃用户）
    const baseFilter = `(u.role='user' OR (u.role IN ('admin','operator','writer') AND ma.user_id IS NOT NULL))`;
    const w = s ? `WHERE email ILIKE $1 AND ${baseFilter}` : `WHERE ${baseFilter}`;
    const ps = s ? [`%${s}%`, o] : [o];
    return (await this.db.query(
      `SELECT u.id, u.email, u.display_name, u.role, u.wechat_openid, u.is_disabled, u.created_at,
              COALESCE(ma.credit_balance,0) as credits, ma.plan, ma.monthly_credits, ma.credits_used_this_month,
              ma.expires_at as member_expires,
              (SELECT started_at FROM user_subscriptions WHERE user_id=u.id AND status='active' LIMIT 1) as member_start
       FROM users u LEFT JOIN membership_accounts ma ON ma.user_id=u.id
       ${w} ORDER BY u.created_at DESC LIMIT 20 OFFSET $${s ? 2 : 1}`, ps)).rows;
  }

  // ====== 写作配置 ======
  @Get('product-configs') @UseGuards(AdminGuard) async productConfigs() { return (await this.db.query('SELECT * FROM product_choices WHERE is_active=true ORDER BY product_type, category, sort_order, recommendation DESC')).rows; }
  @Post('product-configs') @UseGuards(AdminGuard) async saveProductConfig(@Body() b: any) { const r = await this.db.query(`INSERT INTO product_choices (product_type,category,value,label,description,recommendation,tags,channel,compatible_modes,sort_order,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()) ON CONFLICT(product_type,category,value) DO UPDATE SET label=$4,description=$5,recommendation=$6,tags=$7,channel=$8,compatible_modes=$9,sort_order=$10,updated_at=now() RETURNING *`, [b.product_type, b.category, b.value, b.label, b.description || '', b.recommendation || 0, b.tags || [], b.channel || null, b.compatible_modes || [], b.sort_order || 0]); return r.rows[0]; }
  @Delete('product-configs/:id') @UseGuards(AdminGuard) async deleteProductConfig(@Param('id') id: string) { await this.db.query('DELETE FROM product_choices WHERE id=$1', [id]); return { ok: true }; }

  // SKILL 提示词配置（支持多版本）
  @Get('skill-prompts') @UseGuards(AdminGuard) async listSkillPrompts() { return (await this.db.query('SELECT * FROM skill_prompts ORDER BY node_key, sort_order, name')).rows; }
  @Post('skill-prompts') @UseGuards(AdminGuard) async createSkillPrompt(@Body() b: any) { const r = await this.db.query(`INSERT INTO skill_prompts (node_key, node_label, name, prompt_content, description, is_default, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [b.node_key, b.node_label, b.name || '新提示词', b.prompt_content, b.description || '', b.is_default || false, b.sort_order || 0]); return r.rows[0]; }
  @Put('skill-prompts/:id') @UseGuards(AdminGuard) async updateSkillPrompt(@Param('id') id: string, @Body() b: any) {
    // 如果设置为默认，取消同 node_key 下其他默认
    if (b.is_default) await this.db.query('UPDATE skill_prompts SET is_default=false WHERE node_key=(SELECT node_key FROM skill_prompts WHERE id=$1) AND id!=$1', [id]);
    const sets: string[] = ['prompt_content=$2', 'name=$3', 'is_default=$4', 'sort_order=$5', 'updated_at=now()']; const ps: any[] = [b.prompt_content, b.name, b.is_default || false, b.sort_order || 0, id];
    if (b.description !== undefined) { sets.splice(1, 0, 'description=$' + (sets.length + 1)); ps.splice(1, 0, b.description); }
    await this.db.query(`UPDATE skill_prompts SET ${sets.join(',')} WHERE id=$${ps.length}`, ps);
    return { ok: true };
  }
  @Delete('skill-prompts/:id') @UseGuards(AdminGuard) async deleteSkillPrompt(@Param('id') id: string) { await this.db.query('DELETE FROM skill_prompts WHERE id=$1', [id]); return { ok: true }; }

  @Get('writing-models') @UseGuards(AdminGuard) async writingModels() { return { systemModels: (await this.db.query('SELECT * FROM system_models ORDER BY priority DESC')).rows, defaultModels: (await this.db.query('SELECT key, value FROM system_settings WHERE key LIKE $1', ['default_model_%'])).rows }; }
  @Put('writing-models') @UseGuards(AdminGuard) async updateWritingModels(@Body() b: Record<string, string>) { for (const [k, v] of Object.entries(b)) { await this.db.query(`INSERT INTO system_settings(key,value,updated_at) VALUES($1,$2::jsonb,now()) ON CONFLICT(key) DO UPDATE SET value=$2::jsonb,updated_at=now()`, [`default_model_${k}`, JSON.stringify(v)]); } return { ok: true }; }

  @Get('models') @UseGuards(AdminGuard) async listModels() { return (await this.db.query('SELECT * FROM system_models ORDER BY priority DESC')).rows; }
  @Post('models') @UseGuards(AdminGuard) async createModel(@Body() b: any) { const r = await this.db.query(`INSERT INTO system_models (name,provider,model_id,base_url,api_key,is_enabled,priority,price_per_1k_cache,price_per_1k_input,price_per_1k_output,model_type,max_output_tokens) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [b.name, b.provider, b.model_id, b.base_url, b.api_key || null, b.is_enabled ?? true, b.priority ?? 0, b.price_per_1k_cache || 0, b.price_per_1k_input || 0.001, b.price_per_1k_output || 0.002, b.model_type || 'text', b.max_output_tokens || 320000]); return r.rows[0]; }
  @Put('models/:id') @UseGuards(AdminGuard) async updateModel(@Param('id') id: string, @Body() b: any) { const r = await this.db.query(`UPDATE system_models SET name=$1,provider=$2,model_id=$3,base_url=$4,api_key=$5,is_enabled=$6,priority=$7,price_per_1k_cache=$8,price_per_1k_input=$9,price_per_1k_output=$10,model_type=$11,max_output_tokens=$12,updated_at=now() WHERE id=$13 RETURNING *`, [b.name, b.provider, b.model_id, b.base_url, b.api_key || null, b.is_enabled ?? true, b.priority ?? 0, b.price_per_1k_cache || 0, b.price_per_1k_input || 0.001, b.price_per_1k_output || 0.002, b.model_type || 'text', b.max_output_tokens || 320000, id]); return r.rows[0]; }
  @Delete('models/:id') @UseGuards(AdminGuard) async deleteModel(@Param('id') id: string) { await this.db.query('DELETE FROM system_models WHERE id=$1', [id]); return { ok: true }; }

  @Get('reviews') @UseGuards(AdminGuard) async listReviews(@Query('status') status?: string, @Query('page') p = 1) { const o = (p - 1) * 20; const filter = status ? `WHERE s.status=$1` : `WHERE s.status IN ('pending','reviewing','approved','rejected')`; const params: any[] = status ? [status, o] : [o]; const r = await this.db.query(`SELECT s.*,u.email as user_email FROM submissions s JOIN users u ON u.id=s.user_id ${filter} ORDER BY s.created_at DESC LIMIT 20 OFFSET $${status ? 2 : 1}`, params); return { items: r.rows, page: p }; }
  @Put('reviews/:id') @UseGuards(AdminGuard) async review(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() b: { decision: string; comment?: string; score?: number }) { if (!['approved', 'rejected'].includes(b.decision)) throw new BadRequestException('invalid decision'); if (b.decision === 'rejected' && !b.comment?.trim()) throw new BadRequestException({ code: 'REJECT_NEEDS_COMMENT' }); await this.db.query(`UPDATE submissions SET status=$1,reviewer_id=$2,reviewer_comment=$3,reviewer_score=$4,reviewed_at=now(),updated_at=now() WHERE id=$5`, [b.decision, req.user.id, b.comment || '', b.score || 0, id]); return { ok: true }; }

  @Get('settings') @UseGuards(AdminGuard) async getSettings() { const r = await this.db.query('SELECT key,value FROM system_settings'); const s: any = {}; r.rows.forEach((x: any) => { s[x.key] = x.value; }); return s; }
  @Put('settings') @UseGuards(AdminGuard) async updateSettings(@Body() b: any) { for (const [k, v] of Object.entries(b)) { await this.db.query(`INSERT INTO system_settings(key,value,updated_at) VALUES($1,$2::jsonb,now()) ON CONFLICT(key) DO UPDATE SET value=$2::jsonb,updated_at=now()`, [k, JSON.stringify(v)]); } return { ok: true }; }

  @Get('prompt-debug-logs') @UseGuards(AdminGuard)
  async promptDebugLogs(@Query('limit') limit = 50) {
    return (await this.db.query(
      `SELECT l.id, l.user_id, u.email as user_email, l.operation, l.model, l.skill_prompt, l.user_prompt, l.full_system_prompt, l.response, l.created_at
       FROM model_prompt_debug_logs l LEFT JOIN users u ON u.id=l.user_id
       ORDER BY l.created_at DESC LIMIT $1`, [limit])).rows;
  }
}
