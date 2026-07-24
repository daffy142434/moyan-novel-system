import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Put, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { AdminGuard, OperatorGuard } from '../auth/admin-auth.guard';
import { DatabaseService } from '../database/database.service';

@Controller('submissions')
@UseGuards(AuthGuard)
export class SubmissionController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  // ====== 微信 ======
  @Post('bind-wechat') async bindWechat(@Req() req: AuthenticatedRequest, @Body() b: { openid: string; nickname?: string }) { await this.db.query('UPDATE users SET wechat_openid=$1,wechat_nickname=$2 WHERE id=$3',[b.openid,b.nickname||'',req.user.id]); return {ok:true}; }
  @Get('wechat-status') async wechatStatus(@Req() req: AuthenticatedRequest) { const r=await this.db.query('SELECT wechat_openid,wechat_nickname FROM users WHERE id=$1',[req.user.id]); return {bound:!!r.rows[0]?.wechat_openid,nickname:r.rows[0]?.wechat_nickname}; }
  @Get('configs') async configs() { return (await this.db.query("SELECT * FROM submission_configs WHERE is_active=true ORDER BY category,sort_order")).rows; }

  // ====== 送审 3 步 ======

  /** Step 1: 打包三要素并创建审核记录 */
  @Post('step1-pack-elements')
  async step1PackElements(@Req() req: AuthenticatedRequest, @Body() b: { projectId: string; title: string; dramaType: string; styleType: string; episodes: { number: number; title: string; content: string; score: number }[] }) {
    // 校验 ≥5 集 && 每集 ≥90
    if (b.episodes.length < 5) throw new BadRequestException({ code: 'NEED_5_EPISODES', message: '至少需要 5 集内容' });
    const lowScore = b.episodes.find(e => e.score < 90);
    if (lowScore) throw new BadRequestException({ code: 'SCORE_TOO_LOW', message: `第 ${lowScore.number} 集自检分数 ${lowScore.score} 低于 90，不符合送审条件` });

    // 校验微信
    const user = await this.db.query('SELECT wechat_openid FROM users WHERE id=$1', [req.user.id]);
    if (!user.rows[0]?.wechat_openid) throw new ForbiddenException({ code: 'WECHAT_REQUIRED' });

    // 打包三要素
    const elements = {
      title: b.title,
      dramaType: b.dramaType,
      styleType: b.styleType,
      episodeCount: b.episodes.length,
      totalContent: b.episodes.map(e => `第${e.number}集 ${e.title}\n${e.content}`).join('\n\n---\n\n'),
      episodes: b.episodes.map(e => ({ number: e.number, title: e.title, score: e.score })),
    };
    const elementsJson = JSON.stringify(elements);

    const r = await this.db.query(
      `INSERT INTO submissions (user_id, project_id, title, drama_type, style_type, content, elements, episode_count, episode_contents, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'elements_packaged') RETURNING *`,
      [req.user.id, b.projectId, b.title, b.dramaType, b.styleType, elementsJson, elementsJson, b.episodes.length, b.episodes.map(e => e.content)],
    );
    return { ...r.rows[0], elements };
  }

  /** Step 2: 机器审核 */
  @Post(':id/step2-machine-review')
  async step2MachineReview(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const s = await this.db.query('SELECT * FROM submissions WHERE id=$1 AND user_id=$2', [id, req.user.id]);
    if (!s.rows[0]) throw new BadRequestException('NOT_FOUND');

    // 调用自检模型做机检（模拟）
    const score = Math.floor(Math.random() * 16) + 80; // 80-95
    const recommend = score >= 90;
    const report = `机检报告\n\n综合评分: ${score}/100\n${recommend ? '✅ 建议送审' : '❌ 暂不建议送审'}\n\n各维度:\n- 剧情结构: ${score-2}分\n- 人物塑造: ${score}分\n- 对白质量: ${score-1}分\n- 节奏把控: ${score+1}分\n- 市场匹配: ${score}分\n\n${recommend ? '整体质量达标，推荐送审。' : '部分维度需优化，建议修改后重试。'}`;

    await this.db.query(
      `UPDATE submissions SET status='machine_reviewed', machine_review_score=$1, machine_review_report=$2, machine_review_recommend=$3, updated_at=now() WHERE id=$4`,
      [score, report, recommend, id],
    );
    return { score, recommend, report };
  }

  /** Step 3: 确认送审 → 待审核 */
  @Post(':id/step3-submit')
  async step3Submit(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const s = await this.db.query('SELECT * FROM submissions WHERE id=$1 AND user_id=$2', [id, req.user.id]);
    if (!s.rows[0]) throw new BadRequestException('NOT_FOUND');
    if (!s.rows[0].machine_review_recommend || s.rows[0].machine_review_score < 90) {
      throw new BadRequestException({ code: 'MACHINE_REVIEW_NOT_PASSED', message: '机检分数不足 90，无法送审' });
    }
    await this.db.query(`UPDATE submissions SET status='pending', updated_at=now() WHERE id=$1`, [id]);
    return { ok: true };
  }

  // ====== 基本操作 ======
  @Get('my') async mySubmissions(@Req() req: AuthenticatedRequest) { return (await this.db.query('SELECT * FROM submissions WHERE user_id=$1 ORDER BY created_at DESC',[req.user.id])).rows; }
  @Get(':id') async detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) { const r=await this.db.query('SELECT s.*,u2.email as reviewer_email FROM submissions s LEFT JOIN users u2 ON u2.id=s.reviewer_id WHERE s.id=$1 AND s.user_id=$2',[id,req.user.id]); if(!r.rows[0]) throw new BadRequestException('NOT_FOUND'); return r.rows[0]; }
  @Post(':id/withdraw') async withdraw(@Req() req: AuthenticatedRequest, @Param('id') id: string) { await this.db.query(`UPDATE submissions SET status='withdrawn',updated_at=now() WHERE id=$1 AND user_id=$2 AND status IN ('pending','reviewing')`,[id,req.user.id]); return {ok:true}; }
}

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminReviewController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  @Get('reviews') @UseGuards(OperatorGuard) async listReviews(@Query('status') status?: string, @Query('page') p=1) {
    const o=(p-1)*20; const filter=status?`WHERE s.status=$1`:`WHERE s.status IN ('pending','reviewing','approved','rejected')`;
    const params:any[]=status?[status,o]:[o];
    const r=await this.db.query(`SELECT s.*,u.email as user_email FROM submissions s JOIN users u ON u.id=s.user_id ${filter} ORDER BY s.created_at DESC LIMIT 20 OFFSET $${status?2:1}`,params);
    return {items:r.rows,page:p};
  }

  /** 审核操作：必须填写拒绝理由 */
  @Put('reviews/:id') @UseGuards(OperatorGuard)
  async review(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() b: { decision: string; comment?: string; score?: number }) {
    if (!['approved','rejected'].includes(b.decision)) throw new BadRequestException('决策必须是 approved 或 rejected');
    if (b.decision === 'rejected' && !b.comment?.trim()) throw new BadRequestException({ code: 'REJECT_NEEDS_COMMENT', message: '退回必须填写修改建议' });
    await this.db.query(
      `UPDATE submissions SET status=$1,reviewer_id=$2,reviewer_comment=$3,reviewer_score=$4,reviewed_at=now(),updated_at=now() WHERE id=$5`,
      [b.decision,req.user.id,b.comment||'',b.score||0,id],
    );
    return {ok:true};
  }

  @Get('submission-configs') @UseGuards(OperatorGuard) async listConfigs() { return (await this.db.query('SELECT * FROM submission_configs ORDER BY category,sort_order')).rows; }
  @Post('submission-configs') @UseGuards(OperatorGuard) async saveConfig(@Body() b: any) { const r=await this.db.query(`INSERT INTO submission_configs(category,value,label,is_active,sort_order) VALUES($1,$2,$3,$4,$5) ON CONFLICT(category,value) DO UPDATE SET label=$3,is_active=$4,sort_order=$5 RETURNING *`,[b.category,b.value,b.label,b.is_active??true,b.sort_order||0]); return r.rows[0]; }
  @Put('submission-configs/:id') @UseGuards(OperatorGuard) async updateConfig(@Param('id') id: string, @Body() b: any) { await this.db.query('UPDATE submission_configs SET label=$1,is_active=$2,sort_order=$3 WHERE id=$4',[b.label,b.is_active??true,b.sort_order||0,id]); return {ok:true}; }
}
