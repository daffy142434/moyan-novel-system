import { BadRequestException, Body, Controller, Get, Inject, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { DatabaseService } from '../database/database.service';

@Controller('membership')
@UseGuards(AuthGuard)
export class MembershipController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  // ====== 方案 ======
  @Get('plans') async plans() { return (await this.db.query('SELECT * FROM subscription_plans WHERE is_active=true ORDER BY price_monthly')).rows; }

  // ====== 订阅 ======
  @Get('subscription') async subscription(@Req() req: AuthenticatedRequest) {
    // 自动降级：检查是否已过期
    const expired = await this.db.query(
      `SELECT plan FROM membership_accounts WHERE user_id=$1 AND plan!='free' AND expires_at IS NOT NULL AND expires_at < now()`,
      [req.user.id],
    );
    if (expired.rows[0]) {
      await this.db.query(
        `UPDATE membership_accounts SET plan='free', monthly_credits=0, expires_at=NULL, updated_at=now()
         WHERE user_id=$1`,
        [req.user.id],
      );
      await this.db.query(
        `UPDATE user_subscriptions SET status='expired' WHERE user_id=$1 AND status='active'`,
        [req.user.id],
      );
    }

    const [m, s] = await Promise.all([
      this.db.query('SELECT * FROM membership_accounts WHERE user_id=$1', [req.user.id]),
      this.db.query(`SELECT us.*, sp.name as plan_name, sp.tier FROM user_subscriptions us JOIN subscription_plans sp ON sp.id=us.plan_id WHERE us.user_id=$1 AND us.status='active' ORDER BY us.created_at DESC LIMIT 1`, [req.user.id]),
    ]);
    const current = m.rows[0] || { plan: 'free', credit_balance: 0, monthly_credits: 0, credits_used_this_month: 0 };
    const activeSub = s.rows[0] || null;
    const txns = (await this.db.query('SELECT * FROM credit_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [req.user.id])).rows;
    return {
      plan: current.plan, creditBalance: Number(current.credit_balance), monthlyCredits: current.monthly_credits, creditsUsedThisMonth: current.credits_used_this_month,
      subscription: activeSub ? { id: activeSub.id, planName: activeSub.plan_name, tier: activeSub.tier, period: activeSub.period, status: activeSub.status, startedAt: activeSub.started_at, expiresAt: activeSub.expires_at, amount: Number(activeSub.amount) } : null,
      transactions: txns.map(t => ({ id: t.id, type: t.type, amount: Number(t.amount), balanceAfter: Number(t.balance_after), description: t.description, createdAt: t.created_at })),
    };
  }

  @Post('subscribe') async subscribe(@Req() req: AuthenticatedRequest, @Body() body: { planId: string; period: 'monthly' | 'yearly' }) {
    const plan = await this.db.query('SELECT * FROM subscription_plans WHERE id=$1 AND is_active=true', [body.planId]);
    if (!plan.rows[0]) throw new BadRequestException('方案不存在');
    const tierOrder: Record<string, number> = { free: 0, plus: 1, max: 2 };
    const current = await this.db.query('SELECT plan FROM membership_accounts WHERE user_id=$1', [req.user.id]);
    const currentTier = current.rows[0]?.plan || 'free';
    if (tierOrder[plan.rows[0].tier] < tierOrder[currentTier]) throw new BadRequestException({ code: 'NO_DOWNGRADE' });
    const p = plan.rows[0];
    const amount = body.period === 'yearly' ? Number(p.price_yearly) : Number(p.price_monthly);
    const now = new Date(); const expiresAt = new Date(now);
    if (body.period === 'yearly') expiresAt.setFullYear(expiresAt.getFullYear() + 1); else expiresAt.setMonth(expiresAt.getMonth() + 1);
    const sub = await this.db.query(`INSERT INTO user_subscriptions (user_id,plan_id,period,status,started_at,expires_at,amount) VALUES ($1,$2,$3,'active',$4,$5,$6) RETURNING *`, [req.user.id, body.planId, body.period, now, expiresAt, amount]);
    await this.db.query(`INSERT INTO membership_accounts (user_id,plan,credit_balance,subscription_id,expires_at,monthly_credits,credits_used_this_month,updated_at) VALUES ($1,$2,$3,$4,$5,$6,0,now()) ON CONFLICT(user_id) DO UPDATE SET plan=$2,subscription_id=$4,expires_at=$5,monthly_credits=$6,credits_used_this_month=0,updated_at=now()`, [req.user.id, p.tier, Number(p.credits_monthly), sub.rows[0].id, expiresAt, p.credits_monthly]);
    return { ok: true, expiresAt };
  }

  @Post('cancel') async cancel(@Req() req: AuthenticatedRequest) { await this.db.query(`UPDATE user_subscriptions SET status='cancelled' WHERE user_id=$1 AND status='active'`, [req.user.id]); return { ok: true }; }

  // ====== 积分管理 ======
  @Get('credits') async credits(@Req() req: AuthenticatedRequest) {
    const [m, txns] = await Promise.all([
      this.db.query('SELECT credit_balance, monthly_credits, credits_used_this_month FROM membership_accounts WHERE user_id=$1', [req.user.id]),
      this.db.query('SELECT * FROM credit_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.id]),
    ]);
    return {
      balance: Number(m.rows[0]?.credit_balance || 0),
      monthlyCredits: m.rows[0]?.monthly_credits || 0,
      usedThisMonth: m.rows[0]?.credits_used_this_month || 0,
      transactions: txns.rows.map(t => ({ id: t.id, type: t.type, amount: Number(t.amount), balanceAfter: Number(t.balance_after), description: t.description, createdAt: t.created_at })),
    };
  }

  /** 充值积分（模拟） */
  @Post('credits/buy') async buyCredits(@Req() req: AuthenticatedRequest, @Body() b: { amount: number; packageId?: string }) {
    const pkg = b.packageId ? (await this.db.query('SELECT * FROM subscription_plans WHERE tier=$1', [b.packageId])).rows[0] : null;
    const credits = b.amount || (pkg ? pkg.credits_monthly : 100);
    const current = await this.db.query('SELECT credit_balance FROM membership_accounts WHERE user_id=$1', [req.user.id]);
    const newBalance = Number(current.rows[0]?.credit_balance || 0) + credits;
    await this.db.query(`INSERT INTO membership_accounts (user_id,credit_balance,updated_at) VALUES ($1,$2,now()) ON CONFLICT(user_id) DO UPDATE SET credit_balance=$2,updated_at=now()`, [req.user.id, newBalance]);
    await this.db.query(`INSERT INTO credit_transactions (user_id,type,amount,balance_after,description) VALUES ($1,'purchase',$2,$3,$4)`, [req.user.id, credits, newBalance, `购买 ${credits} 积分`]);
    return { balance: newBalance };
  }

  /** 调整月积分配额 */
  @Put('credits/monthly-quota') async updateMonthlyQuota(@Req() req: AuthenticatedRequest, @Body() b: { monthlyCredits: number }) {
    await this.db.query(
      `INSERT INTO membership_accounts (user_id, credit_balance, monthly_credits, updated_at) VALUES ($1,0,$2,now()) ON CONFLICT(user_id) DO UPDATE SET monthly_credits=$2,updated_at=now()`,
      [req.user.id, b.monthlyCredits || 10000],
    );
    return { ok: true, monthlyCredits: b.monthlyCredits };
  }

  // ====== 模型广场 ======
  @Get('model-marketplace') async modelMarketplace() {
    return (await this.db.query('SELECT id, name as model_name, provider, model_type, price_per_1k_cache, price_per_1k_input, price_per_1k_output, is_enabled as is_active, priority as sort_order, created_at FROM system_models ORDER BY priority DESC')).rows;
  }

  // ====== 用量统计 ======
  @Get('usage-stats') async usageStats(@Req() req: AuthenticatedRequest) {
    const rows = await this.db.query(
      `SELECT DATE(created_at) as date, COUNT(*)::int as calls, COALESCE(SUM(input_tokens+output_tokens),0)::bigint as tokens, COALESCE(SUM(credits),0)::int as credits
       FROM model_usage WHERE user_id=$1 AND created_at>=CURRENT_DATE - INTERVAL '30 days'
       GROUP BY DATE(created_at) ORDER BY date`, [req.user.id]);
    return rows.rows;
  }
}
