import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  BuildArtifactDto,
  BuildStageKey,
  ChoiceOptionDto,
  CreationSessionDto,
  DashboardDto,
  EpisodeAnnotationDto,
  EpisodeDto,
  ProductDefinitionDto,
  ProductType,
  ReviewReportDto,
  StudioProjectDto,
  StudioGenerationInputDto,
} from '@moyan/contracts';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { DatabaseService } from '../database/database.service';
import { DeepSeekService } from '../generation/deepseek.service';
import { SkillService, type WorkflowProduct, type WorkflowStage } from '../skills/skill.service';
import { StudioGenerationService, type GenerationObserver } from './studio-generation.service';

const workflowProducts = ['short_drama', 'comic_drama'] as const;
const buildStages = ['outline', 'proposal', 'characters', 'catalog'] as const;
const buildMetaTitle = (stage: BuildStageKey) => ({ outline: '故事大纲', proposal: '创作方案', characters: '角色开发', catalog: '目录大纲' } as const)[stage];

const creativeResponseSchema = z.object({
  content: z.string().min(1),
  summary: z.string().default(''),
  titles: z.array(z.string()).default([]),
  title: z.string().optional(),
});

const reviewResponseSchema = z.object({
  score: z.coerce.number().int().min(0).max(100),
  summary: z.string().default(''),
  suggestions: z.array(z.string()).default([]),
  dimensions: z.record(z.string(), z.coerce.number()).default({}),
});

interface SessionRow {
  id: string;
  product_type: ProductType;
  selections: Record<string, unknown>;
  proposal_content: string;
  proposal_summary: string;
  title_options: string[];
  selected_title: string;
  expires_at: Date;
}

interface ProjectRow {
  id: string;
  title: string;
  product_type: ProductType;
  production_mode: string;
  genre: string;
  visual_style: string;
  audience: string;
  tone: string;
  ending_type: string;
  language: string;
  episode_count: number;
  lifecycle_status: StudioProjectDto['lifecycleStatus'];
  construction_locked: boolean;
  synopsis: string;
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface BuildRow {
  id: string;
  stage: BuildStageKey;
  status: BuildArtifactDto['status'];
  version: number;
  content: string;
  summary: string;
  updated_at: Date;
}

interface EpisodeRow {
  id: string;
  number: number;
  title: string;
  outline_summary: string;
  status: EpisodeDto['status'];
  content: string;
  content_version: number;
  updated_at: Date;
}

const option = (
  value: string,
  label: string,
  description: string,
  recommendation = 3,
  tags: string[] = [],
  compatibleModes?: string[],
): ChoiceOptionDto => ({ value, label, description, recommendation, tags, compatibleModes });

@Injectable()
export class StudioService {
  private readonly promptDebugEnabled: boolean;

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(SkillService) private readonly skills: SkillService,
    @Inject(DeepSeekService) private readonly deepSeek: DeepSeekService,
    @Inject(StudioGenerationService) private readonly runs: StudioGenerationService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.promptDebugEnabled = config.get<string>('PROMPT_DEBUG_ENABLED', 'true').toLowerCase() !== 'false';
  }

  startGeneration(userId: string, input: StudioGenerationInputDto) {
    return this.runs.start(userId, input.scope, async (observer) => {
      if (input.scope === 'proposal' && input.sessionId) return this.generateProposal(userId, input.sessionId, input.instruction ?? '', observer);
      if (input.scope === 'build' && input.projectId && input.stage) return this.generateBuild(userId, input.projectId, input.stage, input.instruction ?? '', observer);
      if (input.scope === 'episode_generate' && input.projectId && input.episodeNumber) return this.generateEpisode(userId, input.projectId, input.episodeNumber, input.instruction ?? '', observer);
      if (input.scope === 'episode_optimize' && input.projectId && input.episodeNumber) return this.optimizeEpisode(userId, input.projectId, input.episodeNumber, input.instruction ?? '', observer);
      if (input.scope === 'episode_review' && input.projectId && input.episodeNumber) return this.reviewEpisode(userId, input.projectId, input.episodeNumber, observer);
      throw new BadRequestException({ code: 'INVALID_GENERATION_INPUT' });
    });
  }

  products(): ProductDefinitionDto[] {
    const commonSettings = {
      audiences: [
        option('male', '男频', '强调实力、逆袭和高密度爽点'),
        option('female', '女频', '强调情绪拉扯、关系与身份反转'),
        option('all', '全年龄', '兼顾温情、正义与大众共鸣', 2),
      ],
      tones: [
        option('爽燃', '爽燃', '快节奏、高压冲突和连续回报'),
        option('甜虐', '甜虐', '甜蜜与情感伤害交替推进'),
        option('搞笑', '搞笑', '轻松、反差和密集笑点', 2),
        option('暗黑', '暗黑', '压迫感、复仇与灰度抉择', 2),
        option('温情', '温情', '家庭、成长和情感治愈', 2),
      ],
      endings: [
        option('圆满', '圆满', '主要冲突解决并给出情感回报'),
        option('开放', '开放', '保留想象与讨论空间', 2),
        option('反转', '反转', '结尾重新解释前文信息'),
        option('悲情', '悲情', '以代价和遗憾形成余味', 2),
      ],
      episodeCounts: [30, 50, 60, 70, 80],
      languages: [
        option('zh-CN', '中文', '输出中文剧本'),
        option('en', '英文', '输出英文剧本并执行文化适配', 2),
      ],
    };
    const dramaModes = [
      option('domestic', '国内下沉剧', '国内平台、中文、接地气的小人物成长与强节奏'),
      option('overseas_live', '海外仿真人原创', '海外真人拍摄，使用本地化人物与可拍场景'),
      option('overseas_ai', '海外 AI 剧本', '面向 AI 漫或仿真人制作，视觉自由度更高'),
    ];
    const dramaGenres = [
      option('都市情感', '都市情感', '爱情、婚姻与家庭关系冲突', 4, ['女频']),
      option('霸道总裁', '霸道总裁', '豪门身份差与情感博弈', 3, ['女频']),
      option('甜宠', '甜宠', '高甜互动与轻冲突', 2, ['女频']),
      option('重生穿越', '重生穿越', '利用第二次机会改变命运', 5, ['通用']),
      option('战神归来', '战神归来', '隐藏强者回归并完成身份碾压', 4, ['男频']),
      option('古装宫廷', '古装宫廷', '权谋、宫斗与身份关系', 4, ['女频']),
      option('励志逆袭', '励志逆袭', '底层人物通过行动完成成长', 5, ['通用']),
      option('家庭伦理', '家庭伦理', '家庭成员的现实矛盾与和解', 4, ['全年龄']),
      option('萌宝', '萌宝', '以孩子连接家庭和感情线', 3, ['女频']),
      option('悬疑探案', '悬疑探案', '用线索和调查推动高压剧情', 3, ['男频']),
      option('软科幻轻悬疑', '软科幻轻悬疑', '科技概念叠加易理解的悬念', 4, ['差异化']),
      option('末日重生', '末日重生', '预知灾难、资源竞争和求生逆袭', 4, ['男频']),
      option('喜剧', '喜剧', '用反差和误会提供解压体验', 3, ['全年龄']),
    ].map((item) => ({ ...item, channel: this.genreChannel(item.value, 'short_drama') }));
    const comicModes = [
      option('domestic', '国内漫剧', '国内平台投放，中文剧本，男频视觉爽感优先'),
      option('overseas', '海外原创漫剧', '海外平台投放，文化本地化与英文输出'),
    ];
    const comicGenres = [
      option('修仙觉醒', '修仙觉醒', '废柴觉醒血脉或灵根，持续升级', 5, ['第一梯队']),
      option('玄幻逆袭', '玄幻逆袭', '异世界底层成长至巅峰', 5, ['第一梯队']),
      option('神兽进化', '神兽进化', '吞噬、进化与形态变化带来视觉爽点', 5, ['第一梯队']),
      option('末世重生', '末世重生', '末日求生与前世信息差', 4, ['第一梯队']),
      option('战神归来', '战神归来', '强者回归，需要差异化设定', 3, ['经典']),
      option('系统流', '系统流', '任务、奖励与能力成长机制', 4, ['叠加元素']),
      option('科幻', '科幻', '星际、机甲、赛博和 AI 觉醒', 5, ['新增核心']),
      option('悬疑', '悬疑', '视觉线索、解谜和惊悚气氛', 5, ['新增核心']),
      option('古装宫廷', '古装宫廷', '宏大古装场面与女主逆袭', 4, ['女频']),
      option('都市情感', '都市情感', '情感题材叠加超自然元素', 3, ['女频']),
      option('喜剧沙雕', '喜剧/沙雕', '夸张表情和反差笑点', 3, ['全年龄']),
      option('甜宠', '甜宠', '梦幻恋爱画面，赛道竞争激烈', 1, ['谨慎']),
      option('萌宝', '萌宝', '家庭与孩子驱动情感关系', 2, ['女频']),
      option('小众二次元', '小众二次元', '机甲娘、蒸汽朋克等垂直赛道', 4, ['蓝海']),
      option('互动漫剧', '互动漫剧', '分支剧情和多结局', 4, ['蓝海']),
      option('IP改编', 'IP 改编', '基于授权 IP 开发，自带流量', 3, ['需版权']),
    ].map((item) => ({ ...item, channel: this.genreChannel(item.value, 'comic_drama') }));
    const visualStyles = [
      option('3d_cg', '3D CG 渲染', '电影级光影与材质，适合玄幻、末世和战斗'),
      option('cel_shading', '2D 赛璐璐', '明亮色块与夸张表情，适合甜宠、校园和喜剧'),
      option('ink', '水墨国风', '留白和写意动态，适合仙侠、武侠与历史'),
      option('painterly', '厚涂写实', '强明暗与油画质感，适合悬疑和暗黑复仇'),
      option('cyber_comic', '美漫/赛博朋克', '高饱和霓虹与动态构图，适合科幻和出海'),
      option('photoreal', '真人写实', '自然光照和生活质感，适合都市与职场'),
    ];
    return [
      {
        type: 'short_drama', title: '短剧剧本创作', enabled: true, badge: '主力',
        description: '从市场定位到分集剧本、自检的真人短剧完整工作流。',
        modes: dramaModes, genres: dramaGenres, settings: { ...commonSettings, episodeCounts: [50, 60, 70] },
      },
      {
        type: 'comic_drama', title: 'AI 漫剧剧本创作', enabled: true, badge: '主力',
        description: '面向 AI 画面生产，包含视觉风格、视觉锚点与画面可行性自检。',
        modes: comicModes, genres: comicGenres, visualStyles,
        settings: { ...commonSettings, episodeCounts: [30, 40, 50, 60, 70, 80, 100] },
      },
      ...['长篇小说', '小说转剧本', '视频扒剧本', '洗稿重构', '视觉指导', '美术指导', '执行场记', '平台规范', '合规审核'].map((title, index) => ({
        type: `reserved_${index}`, title, enabled: false, badge: '即将开放',
        description: '能力入口已经预留，后续开放。', modes: [], genres: [], settings: commonSettings,
      })),
    ];
  }

  async createSession(userId: string, productType: ProductType): Promise<CreationSessionDto> {
    if (!workflowProducts.includes(productType as WorkflowProduct)) {
      throw new BadRequestException({ code: 'PRODUCT_NOT_CREATABLE' });
    }
    const result = await this.database.query<SessionRow>(
      `insert into creation_sessions(user_id, product_type) values ($1, $2)
       returning id, product_type, selections, proposal_content, proposal_summary, title_options,
                 selected_title, expires_at`,
      [userId, productType],
    );
    return this.mapSession(result.rows[0]);
  }

  async updateSession(userId: string, sessionId: string, input: { selections?: Record<string, unknown>; selectedTitle?: string; proposalContent?: string }) {
    const current = await this.getSessionRow(userId, sessionId);
    const selections = this.normalizeSelections(current.product_type, { ...current.selections, ...(input.selections ?? {}) });
    const selectedTitle = input.selectedTitle ?? current.selected_title;
    const proposalContent = input.proposalContent ?? current.proposal_content;
    const result = await this.database.query<SessionRow>(
      `update creation_sessions set selections = $3::jsonb, selected_title = $4, proposal_content = $5, updated_at = now()
       where id = $1 and user_id = $2
       returning id, product_type, selections, proposal_content, proposal_summary, title_options,
                 selected_title, expires_at`,
      [sessionId, userId, JSON.stringify(selections), selectedTitle, proposalContent],
    );
    return this.mapSession(result.rows[0]);
  }

  async generateProposal(userId: string, sessionId: string, instruction: string, streamObserver?: GenerationObserver) {
    const session = await this.getSessionRow(userId, sessionId);
    this.validateSelections(session.product_type, session.selections);
    const material = await this.skills.getWorkflowMaterial(session.product_type as WorkflowProduct, 'proposal');
    const result = await this.generateCreative(
      userId,
      null,
      'proposal',
      '你是墨研创作方案引擎。请根据创作规则和用户选择生成方案。只返回 JSON：{"content":"完整Markdown方案","summary":"100字内摘要","titles":["标题1","标题2","标题3"]}。',
      JSON.stringify({ selections: session.selections, user_instruction: instruction }),
      material,
      streamObserver,
      { creationSessionId: sessionId },
    );
    const titles = [...new Set([...(result.titles ?? []), result.title].filter((item): item is string => Boolean(item)))].slice(0, 3);
    while (titles.length < 3) titles.push(`未命名作品 ${titles.length + 1}`);
    const updated = await this.database.query<SessionRow>(
      `update creation_sessions
       set proposal_content = $3, proposal_summary = $4, title_options = $5::jsonb,
           selected_title = case when selected_title = '' then $6 else selected_title end, updated_at = now()
       where id = $1 and user_id = $2
       returning id, product_type, selections, proposal_content, proposal_summary, title_options,
                 selected_title, expires_at`,
      [sessionId, userId, result.content, result.summary, JSON.stringify(titles), titles[0]],
    );
    return this.mapSession(updated.rows[0]);
  }

  async confirmSession(userId: string, sessionId: string, selectedTitle: string) {
    const session = await this.getSessionRow(userId, sessionId);
    if (!session.proposal_content) throw new BadRequestException({ code: 'PROPOSAL_REQUIRED' });
    const title = selectedTitle.trim() || session.selected_title || session.title_options[0];
    if (!title) throw new BadRequestException({ code: 'TITLE_REQUIRED' });
    const data = session.selections;
    const projectId = await this.database.transaction(async (client) => {
      const project = await client.query<{ id: string }>(
        `insert into projects(
           user_id, title, genre, core_idea, core_conflict, tone, creation_mode, current_step,
           product_type, production_mode, visual_style, audience, ending_type, language,
           episode_count, lifecycle_status, construction_locked, synopsis, settings
         ) values ($1,$2,$3,$4,$5,$6,$7,'characters',$7,$8,$9,$10,$11,$12,$13,'building',false,$14,$15::jsonb)
         returning id`,
        [
          userId, title, String(data.genre ?? ''), session.proposal_summary || '待完善',
          String(data.specialRequirements ?? '待从创作方案提炼'), String(data.tone ?? ''), session.product_type,
          String(data.mode ?? ''), String(data.visualStyle ?? ''), String(data.audience ?? ''),
          String(data.ending ?? ''), String(data.language ?? 'zh-CN'), Number(data.episodeCount ?? 60),
          session.proposal_summary, JSON.stringify(data),
        ],
      );
      await client.query(
        `insert into project_build_artifacts(project_id, stage, status, content, summary)
         values ($1,'proposal','confirmed',$2,$3), ($1,'characters','available','',''), ($1,'catalog','locked','','')`,
        [project.rows[0].id, session.proposal_content, session.proposal_summary],
      );
      await client.query(`delete from creation_sessions where id = $1 and user_id = $2`, [sessionId, userId]);
      await client.query(
        `insert into membership_accounts(user_id) values ($1) on conflict (user_id) do nothing`,
        [userId],
      );
      return project.rows[0].id;
    });
    return this.getProject(userId, projectId);
  }

  async listProjects(userId: string): Promise<StudioProjectDto[]> {
    const result = await this.database.query<ProjectRow>(
      `select id, title, product_type, production_mode, genre, visual_style, audience, tone,
              ending_type, language, episode_count, lifecycle_status, construction_locked,
              synopsis, settings, created_at, updated_at
       from projects where user_id = $1 and status != 'deleted'
         and product_type in ('short_drama','comic_drama') order by updated_at desc`,
      [userId],
    );
    return Promise.all(result.rows.map((row) => this.getProject(userId, row.id)));
  }

  async dashboard(userId: string): Promise<DashboardDto> {
    await this.database.query(`insert into membership_accounts(user_id) values ($1) on conflict (user_id) do nothing`, [userId]);
    const [projects, account, usage, episodeCounts] = await Promise.all([
      this.listProjects(userId),
      this.database.query<{ plan: 'free' | 'plus' | 'max'; credit_balance: string }>(
        `select plan, credit_balance from membership_accounts where user_id = $1`, [userId],
      ),
      this.database.query<{ input_tokens: string; output_tokens: string; credits: string }>(
        `select coalesce(sum(input_tokens),0) input_tokens, coalesce(sum(output_tokens),0) output_tokens,
                coalesce(sum(credits),0) credits from model_usage
         where user_id = $1 and created_at >= date_trunc('month', now())`, [userId],
      ),
      this.database.query<{ total: string; completed: string }>(
        `select count(*) total, count(*) filter(where e.status = 'confirmed') completed
         from episodes e join projects p on p.id = e.project_id where p.user_id = $1`, [userId],
      ),
    ]);
    const statusCounts: Record<string, number> = {};
    for (const project of projects) statusCounts[project.lifecycleStatus] = (statusCounts[project.lifecycleStatus] ?? 0) + 1;
    return {
      projectCount: projects.length,
      statusCounts,
      totalEpisodes: Number(episodeCounts.rows[0]?.total ?? 0),
      completedEpisodes: Number(episodeCounts.rows[0]?.completed ?? 0),
      membership: {
        plan: account.rows[0]?.plan ?? 'free',
        creditBalance: Number(account.rows[0]?.credit_balance ?? 0),
      },
      usage: {
        inputTokens: Number(usage.rows[0]?.input_tokens ?? 0),
        outputTokens: Number(usage.rows[0]?.output_tokens ?? 0),
        credits: Number(usage.rows[0]?.credits ?? 0),
      },
      recentProjects: projects.slice(0, 5),
    };
  }

  async getModels() {
    return (await this.database.query('SELECT * FROM system_models WHERE is_enabled=true ORDER BY priority DESC')).rows;
  }

  async getProject(userId: string, projectId: string): Promise<StudioProjectDto> {
    const projectResult = await this.database.query<ProjectRow>(
      `select id, title, product_type, production_mode, genre, visual_style, audience, tone,
              ending_type, language, episode_count, lifecycle_status, construction_locked,
              synopsis, settings, created_at, updated_at
       from projects where id = $1 and user_id = $2 and status != 'deleted'
         and product_type in ('short_drama','comic_drama')`,
      [projectId, userId],
    );
    const row = projectResult.rows[0];
    if (!row) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND' });
    const [buildResult, episodesResult, annotationResult, reviewResult] = await Promise.all([
      this.database.query<BuildRow>(
        `select id, stage, status, version, content, summary, updated_at
         from project_build_artifacts where project_id = $1
         order by case stage when 'proposal' then 0 when 'characters' then 1 else 2 end`, [projectId],
      ),
      this.database.query<EpisodeRow>(
        `select id, number, title, outline_summary, status, content, content_version, updated_at
         from episodes where project_id = $1 order by number`, [projectId],
      ),
      this.database.query<{
        id: string; episode_id: string; start_offset: number; end_offset: number;
        quoted_text: string; note: string; created_at: Date;
      }>(
        `select ea.id, ea.episode_id, ea.start_offset, ea.end_offset, ea.quoted_text, ea.note, ea.created_at
         from episode_annotations ea join episodes e on e.id = ea.episode_id
         where e.project_id = $1 order by ea.created_at`, [projectId],
      ),
      this.database.query<{
        id: string; episode_id: string; score: number; summary: string; suggestions: string[];
        dimensions: Record<string, number>; content_version: number; created_at: Date;
      }>(
        `select distinct on (rr.episode_id) rr.id, rr.episode_id, rr.score, rr.summary, rr.suggestions,
                rr.dimensions, rr.content_version, rr.created_at
         from review_reports rr join episodes e on e.id = rr.episode_id
         where e.project_id = $1 order by rr.episode_id, rr.created_at desc`, [projectId],
      ),
    ]);
    const annotations = new Map<string, EpisodeAnnotationDto[]>();
    for (const item of annotationResult.rows) {
      const list = annotations.get(item.episode_id) ?? [];
      list.push({
        id: item.id, startOffset: item.start_offset, endOffset: item.end_offset,
        quotedText: item.quoted_text, note: item.note, createdAt: item.created_at.toISOString(),
      });
      annotations.set(item.episode_id, list);
    }
    const reports = new Map<string, ReviewReportDto>();
    for (const item of reviewResult.rows) {
      reports.set(item.episode_id, {
        id: item.id, score: item.score, summary: item.summary, suggestions: item.suggestions,
        dimensions: item.dimensions, contentVersion: item.content_version, createdAt: item.created_at.toISOString(),
      });
    }
    return {
      id: row.id, title: row.title, productType: row.product_type,
      productionMode: row.production_mode, genre: row.genre, visualStyle: row.visual_style,
      audience: row.audience, tone: row.tone, endingType: row.ending_type, language: row.language,
      episodeCount: row.episode_count, lifecycleStatus: row.lifecycle_status,
      constructionLocked: row.construction_locked, synopsis: row.synopsis, settings: row.settings,
      buildArtifacts: buildResult.rows.map((item) => ({
        id: item.id, stage: item.stage, status: item.status, version: item.version,
        content: item.content, summary: item.summary, updatedAt: item.updated_at.toISOString(),
      })),
      episodes: episodesResult.rows.map((item) => ({
        id: item.id, number: item.number, title: item.title, outlineSummary: item.outline_summary,
        status: item.status, content: item.content, contentVersion: item.content_version,
        annotations: annotations.get(item.id) ?? [], latestReview: reports.get(item.id) ?? null,
        updatedAt: item.updated_at.toISOString(),
      })),
      createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
    };
  }

  async deleteProject(userId: string, projectId: string) {
    const result = await this.database.query<{ id: string }>(
      `delete from projects where id = $1 and user_id = $2 returning id`,
      [projectId, userId],
    );
    if (!result.rowCount) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND' });
    return { deleted: true, id: result.rows[0].id };
  }

  async generateBuild(userId: string, projectId: string, stage: BuildStageKey, instruction: string, streamObserver?: GenerationObserver) {
    this.assertBuildStage(stage);
    const project = await this.getProject(userId, projectId);
    if (project.constructionLocked) throw new BadRequestException({ code: 'CONSTRUCTION_LOCKED' });
    const artifact = project.buildArtifacts.find((item) => item.stage === stage);
    if (!artifact || artifact.status === 'locked') throw new BadRequestException({ code: 'BUILD_STAGE_LOCKED' });
    const workflowStage = stage as WorkflowStage;
    const material = await this.skills.getWorkflowMaterial(project.productType as WorkflowProduct, workflowStage);
    const prior = project.buildArtifacts.filter((item) => item.status === 'confirmed' && item.stage !== stage);
    const result = await this.generateCreative(
      userId,
      projectId,
      `build:${stage}`,
      `生成${buildMetaTitle(stage)}文档。严格依据创作规则和已确认内容，只返回 JSON：{"content":"完整Markdown","summary":"100字内摘要","titles":[]}。`,
      JSON.stringify({ project, confirmed_artifacts: prior, existing_content: artifact.content, instruction }),
      material,
      streamObserver,
    );
    await this.database.query(
      `update project_build_artifacts set status = 'candidate', content = $4, summary = $5,
              version = version + 1, updated_at = now()
       where project_id = $1 and stage = $2 and id = $3`,
      [projectId, stage, artifact.id, result.content, result.summary],
    );
    return this.getProject(userId, projectId);
  }

  async saveBuild(userId: string, projectId: string, stage: BuildStageKey, content: string, summary: string) {
    this.assertBuildStage(stage);
    const project = await this.getProject(userId, projectId);
    if (project.constructionLocked) throw new BadRequestException({ code: 'CONSTRUCTION_LOCKED' });
    const artifact = project.buildArtifacts.find((item) => item.stage === stage);
    if (!artifact || artifact.status === 'locked') throw new BadRequestException({ code: 'BUILD_STAGE_LOCKED' });
    await this.database.query(
      `update project_build_artifacts set content = $4, summary = case when $5 = '' then summary else $5 end,
              status = 'candidate', version = version + 1, updated_at = now()
       where project_id = $1 and stage = $2 and id = $3`,
      [projectId, stage, artifact.id, content, summary],
    );
    return this.getProject(userId, projectId);
  }

  async confirmBuild(userId: string, projectId: string, stage: BuildStageKey) {
    this.assertBuildStage(stage);
    const project = await this.getProject(userId, projectId);
    if (project.constructionLocked) throw new BadRequestException({ code: 'CONSTRUCTION_LOCKED' });
    const artifact = project.buildArtifacts.find((item) => item.stage === stage);
    if (!artifact?.content) throw new BadRequestException({ code: 'BUILD_CONTENT_REQUIRED' });
    await this.database.transaction(async (client) => {
      await client.query(
        `update project_build_artifacts set status = 'confirmed', updated_at = now()
         where project_id = $1 and stage = $2`, [projectId, stage],
      );
      if (stage === 'characters') {
        await client.query(
          `update project_build_artifacts set status = 'available', updated_at = now()
           where project_id = $1 and stage = 'catalog'`, [projectId],
        );
        await client.query(`update projects set current_step = 'catalog', updated_at = now() where id = $1`, [projectId]);
      }
      if (stage === 'catalog') {
        const catalog = this.extractCatalog(artifact.content, project.episodeCount);
        for (let number = 1; number <= project.episodeCount; number += 1) {
          const item = catalog.get(number);
          await client.query(
            `insert into episodes(project_id, number, title, outline_summary, status)
             values ($1,$2,$3,$4,$5) on conflict(project_id, number) do nothing`,
            [projectId, number, item?.title ?? `第${number}集`, item?.summary ?? '', number === 1 ? 'available' : 'locked'],
          );
        }
        await client.query(
          `update project_build_artifacts set status = 'locked' where project_id = $1`, [projectId],
        );
        await client.query(
          `update projects set lifecycle_status = 'ready_to_write', construction_locked = true,
                  current_step = 'episode_1', updated_at = now() where id = $1`, [projectId],
        );
      }
    });
    return this.getProject(userId, projectId);
  }

  async rewindBuild(userId: string, projectId: string, stage: BuildStageKey) {
    this.assertBuildStage(stage);
    const project = await this.getProject(userId, projectId);
    if (project.constructionLocked) throw new BadRequestException({ code: 'CONSTRUCTION_LOCKED' });
    const order: BuildStageKey[] = ['proposal', 'characters', 'catalog'];
    const index = order.indexOf(stage);
    await this.database.transaction(async (client) => {
      await client.query(
        `update project_build_artifacts set status = case when stage = $2 then 'available' else status end,
                updated_at = now() where project_id = $1`, [projectId, stage],
      );
      for (const later of order.slice(index + 1)) {
        await client.query(
          `update project_build_artifacts set status = 'locked', content = '', summary = '', version = version + 1,
                  updated_at = now() where project_id = $1 and stage = $2`, [projectId, later],
        );
      }
      await client.query(`update projects set current_step = $2, updated_at = now() where id = $1`, [projectId, stage]);
    });
    return this.getProject(userId, projectId);
  }

  async generateEpisode(userId: string, projectId: string, number: number, instruction: string, streamObserver?: GenerationObserver) {
    const { project, episode } = await this.getEpisodeContext(userId, projectId, number);
    if (episode.status === 'locked') throw new BadRequestException({ code: 'PREVIOUS_EPISODE_REQUIRED' });
    const material = await this.skills.getWorkflowMaterial(project.productType as WorkflowProduct, 'episode');
    const recentEpisodes = project.episodes.filter((item) => item.number < number && item.status === 'confirmed').slice(-3);
    const result = await this.generateCreative(
      userId,
      projectId,
      'episode',
      `生成第 ${number} 集剧本。严格依据创作规则，只返回 JSON：{"title":"本集标题","content":"完整Markdown剧本","summary":"本集摘要","titles":[]}。`,
      JSON.stringify({ project, episode_outline: episode.outlineSummary, build: project.buildArtifacts, recent_episodes: recentEpisodes, instruction }),
      material,
      streamObserver,
      { episodeId: episode.id },
    );
    await this.database.transaction(async (client) => {
      await client.query(
        `update episodes set title = case when $4 = '' then title else $4 end, content = $5,
                status = 'draft', content_version = content_version + 1, updated_at = now()
         where project_id = $1 and number = $2 and id = $3`,
        [projectId, number, episode.id, result.title ?? '', result.content],
      );
      if (episode.content) await client.query(`delete from episode_annotations where episode_id = $1`, [episode.id]);
    });
    await this.database.query(
      `update projects set lifecycle_status = 'writing', current_step = $2, updated_at = now() where id = $1`,
      [projectId, `episode_${number}`],
    );
    return this.getProject(userId, projectId);
  }

  async saveEpisode(userId: string, projectId: string, number: number, content: string, title?: string) {
    const { episode } = await this.getEpisodeContext(userId, projectId, number);
    if (episode.status === 'locked') throw new BadRequestException({ code: 'EPISODE_LOCKED' });
    await this.database.query(
      `update episodes set content = $4, title = coalesce(nullif($5,''), title), status = 'draft',
              content_version = content_version + 1, updated_at = now()
       where project_id = $1 and number = $2 and id = $3`,
      [projectId, number, episode.id, content, title ?? ''],
    );
    return this.getProject(userId, projectId);
  }

  async addAnnotation(
    userId: string,
    projectId: string,
    number: number,
    input: { startOffset?: number; endOffset?: number; quotedText?: string; note?: string },
  ) {
    const { episode } = await this.getEpisodeContext(userId, projectId, number);
    const start = Number(input.startOffset);
    const end = Number(input.endOffset);
    const note = input.note?.trim() ?? '';
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > episode.content.length || !note) {
      throw new BadRequestException({ code: 'INVALID_ANNOTATION' });
    }
    const quoted = episode.content.slice(start, end);
    if (input.quotedText && input.quotedText !== quoted) throw new BadRequestException({ code: 'ANNOTATION_TEXT_CHANGED' });
    await this.database.query(
      `insert into episode_annotations(episode_id, user_id, start_offset, end_offset, quoted_text, note)
       values ($1,$2,$3,$4,$5,$6)`, [episode.id, userId, start, end, quoted, note],
    );
    return this.getProject(userId, projectId);
  }

  async deleteAnnotation(userId: string, projectId: string, number: number, annotationId: string) {
    const { episode } = await this.getEpisodeContext(userId, projectId, number);
    const result = await this.database.query(
      `delete from episode_annotations where id = $1 and episode_id = $2 and user_id = $3`,
      [annotationId, episode.id, userId],
    );
    if (!result.rowCount) throw new NotFoundException({ code: 'ANNOTATION_NOT_FOUND' });
    return this.getProject(userId, projectId);
  }

  async optimizeEpisode(userId: string, projectId: string, number: number, instruction: string, streamObserver?: GenerationObserver) {
    const { project, episode } = await this.getEpisodeContext(userId, projectId, number);
    if (!episode.content) throw new BadRequestException({ code: 'EPISODE_CONTENT_REQUIRED' });
    const material = await this.skills.getWorkflowMaterial(project.productType as WorkflowProduct, 'episode');
    const result = await this.generateCreative(
      userId,
      projectId,
      'episode_optimize',
      '你是剧本局部优化助手。优先只修改标注覆盖的段落；未标注部分除非为保持衔接不得改写。返回完整正文供用户差异确认。只返回 JSON：{"content":"优化后的完整正文","summary":"改动摘要","titles":[]}。',
      JSON.stringify({ content: episode.content, annotations: episode.annotations, instruction }),
      material,
      streamObserver,
      { episodeId: episode.id },
    );
    return { content: result.content, summary: result.summary };
  }

  async reviewEpisode(userId: string, projectId: string, number: number, streamObserver?: GenerationObserver) {
    const { project, episode } = await this.getEpisodeContext(userId, projectId, number);
    if (!episode.content) throw new BadRequestException({ code: 'EPISODE_CONTENT_REQUIRED' });
    const material = await this.skills.getWorkflowMaterial(project.productType as WorkflowProduct, 'review');
    const response = await this.requestModel(
      userId, projectId, 'review',
      `审核第 ${number} 集。依据创作规则严格审核，只返回 JSON：{"score":0到100,"summary":"审核结论","suggestions":["建议"],"dimensions":{"节奏":0到100,"逻辑":0到100,"人物":0到100,"格式":0到100}}。`,
      JSON.stringify({ project: { type: project.productType, mode: project.productionMode }, episode }),
      material, streamObserver, { episodeId: episode.id },
    );
    const parsed = reviewResponseSchema.parse(JSON.parse(response.content));
    await this.trackUsage(userId, projectId, 'review', response);
    await this.database.query(
      `insert into review_reports(episode_id, score, summary, suggestions, dimensions, content_version)
       values ($1,$2,$3,$4::jsonb,$5::jsonb,$6)`,
      [episode.id, parsed.score, parsed.summary, JSON.stringify(parsed.suggestions), JSON.stringify(parsed.dimensions), episode.contentVersion],
    );
    await this.database.query(`update episodes set status = 'review_required', updated_at = now() where id = $1`, [episode.id]);
    return this.getProject(userId, projectId);
  }

  async confirmEpisode(userId: string, projectId: string, number: number) {
    const { project, episode } = await this.getEpisodeContext(userId, projectId, number);
    const report = episode.latestReview;
    if (!report || report.contentVersion !== episode.contentVersion) throw new BadRequestException({ code: 'CURRENT_REVIEW_REQUIRED' });
    if (report.score < 90) throw new BadRequestException({ code: 'REVIEW_SCORE_TOO_LOW', score: report.score });
    await this.database.transaction(async (client) => {
      await client.query(`update episodes set status = 'confirmed', updated_at = now() where id = $1`, [episode.id]);
      const next = project.episodes.find((item) => item.number === number + 1);
      if (next) {
        await client.query(`update episodes set status = 'available', updated_at = now() where id = $1 and status = 'locked'`, [next.id]);
        await client.query(`update projects set current_step = $2, updated_at = now() where id = $1`, [projectId, `episode_${number + 1}`]);
      } else {
        await client.query(`update projects set lifecycle_status = 'completed', updated_at = now() where id = $1`, [projectId]);
      }
    });
    return this.getProject(userId, projectId);
  }

  private async getEpisodeContext(userId: string, projectId: string, number: number) {
    if (!Number.isInteger(number) || number < 1) throw new BadRequestException({ code: 'INVALID_EPISODE_NUMBER' });
    const project = await this.getProject(userId, projectId);
    const episode = project.episodes.find((item) => item.number === number);
    if (!episode) throw new NotFoundException({ code: 'EPISODE_NOT_FOUND' });
    return { project, episode };
  }

  private async getSessionRow(userId: string, sessionId: string) {
    const result = await this.database.query<SessionRow>(
      `select id, product_type, selections, proposal_content, proposal_summary, title_options,
              selected_title, expires_at from creation_sessions
       where id = $1 and user_id = $2 and expires_at > now()`, [sessionId, userId],
    );
    if (!result.rows[0]) throw new NotFoundException({ code: 'CREATION_SESSION_NOT_FOUND' });
    return result.rows[0];
  }

  private mapSession(row: SessionRow): CreationSessionDto {
    return {
      id: row.id, productType: row.product_type, selections: row.selections,
      proposalContent: row.proposal_content, proposalSummary: row.proposal_summary,
      titleOptions: row.title_options, selectedTitle: row.selected_title,
      expiresAt: row.expires_at.toISOString(),
    };
  }

  private validateSelections(productType: ProductType, selections: Record<string, unknown>) {
    const required = ['mode', 'genre', 'audience', 'tone', 'ending', 'episodeCount', 'language'];
    if (productType === 'comic_drama') required.push('visualStyle');
    const missing = required.filter((key) => selections[key] === undefined || selections[key] === '');
    if (missing.length) throw new BadRequestException({ code: 'CREATION_SELECTIONS_INCOMPLETE', missing });
  }

  private normalizeSelections(productType: ProductType, selections: Record<string, unknown>) {
    const product = this.products().find((item) => item.type === productType);
    const selectedGenre = product?.genres.find((item) => item.value === selections.genre);
    return selectedGenre?.channel ? { ...selections, audience: selectedGenre.channel } : selections;
  }

  private genreChannel(genre: string, product: WorkflowProduct): 'male' | 'female' | 'all' {
    const female = new Set(product === 'short_drama'
      ? ['都市情感', '霸道总裁', '甜宠', '古装宫廷', '萌宝']
      : ['古装宫廷', '都市情感', '甜宠', '萌宝']);
    const male = new Set(product === 'short_drama'
      ? ['战神归来', '悬疑探案', '末日重生']
      : ['修仙觉醒', '玄幻逆袭', '神兽进化', '末世重生', '战神归来', '系统流', '科幻', '悬疑', '小众二次元']);
    if (female.has(genre)) return 'female';
    if (male.has(genre)) return 'male';
    return 'all';
  }

  private assertBuildStage(stage: BuildStageKey): asserts stage is BuildStageKey {
    if (!buildStages.includes(stage)) throw new BadRequestException({ code: 'INVALID_BUILD_STAGE' });
  }

  private async generateCreative(
    userId: string,
    projectId: string | null,
    operation: string,
    orchestrationPrompt: string,
    userPrompt: string,
    material: { version: string; instructions: string },
    streamObserver?: GenerationObserver,
    references: { creationSessionId?: string; episodeId?: string } = {},
  ) {
    const response = await this.requestModel(
      userId, projectId, operation, orchestrationPrompt, userPrompt, material, streamObserver, references,
    );
    const parsed = creativeResponseSchema.parse(JSON.parse(response.content));
    await this.trackUsage(userId, projectId, operation, response);
    return parsed;
  }

  private async requestModel(
    userId: string,
    projectId: string | null,
    operation: string,
    orchestrationPrompt: string,
    userPrompt: string,
    material: { version: string; instructions: string },
    streamObserver?: GenerationObserver,
    references: { creationSessionId?: string; episodeId?: string } = {},
  ) {
    const fullSystemPrompt = `${orchestrationPrompt}\n\n【专业创作规则】\n${material.instructions}`;
    if (this.promptDebugEnabled) {
      await this.database.query(
        `insert into model_prompt_debug_logs(
           user_id, project_id, creation_session_id, episode_id, operation, model, skill_version,
           skill_prompt, orchestration_prompt, user_prompt, full_system_prompt
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          userId, projectId, references.creationSessionId ?? null, references.episodeId ?? null,
          operation, this.deepSeek.primaryModel, material.version, material.instructions,
          orchestrationPrompt, userPrompt, fullSystemPrompt,
        ],
      );
    }
    const observer = streamObserver ?? this.detachedObserver();
    return this.deepSeek.generateJsonStream(
      fullSystemPrompt,
      userPrompt,
      observer.signal,
      { reasoning: observer.reasoning, content: observer.content },
    );
  }

  private detachedObserver(): GenerationObserver {
    return { signal: new AbortController().signal, reasoning: () => undefined, content: () => undefined };
  }

  private async trackUsage(
    userId: string,
    projectId: string | null,
    operation: string,
    response: { model: string; inputTokens: number | null; outputTokens: number | null },
  ) {
    await this.database.query(
      `insert into model_usage(user_id, project_id, operation, model, input_tokens, output_tokens, credits)
       values ($1,$2,$3,$4,$5,$6,0)`,
      [userId, projectId, operation, response.model, response.inputTokens ?? 0, response.outputTokens ?? 0],
    );
  }

  private extractCatalog(content: string, episodeCount: number) {
    const result = new Map<number, { title: string; summary: string }>();
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/第\s*(\d+)\s*集\s*[：:]?\s*([^|｜—-]*)(?:[|｜—-]+\s*(.*))?/);
      if (!match) continue;
      const number = Number(match[1]);
      if (number < 1 || number > episodeCount) continue;
      result.set(number, { title: match[2]?.trim() || `第${number}集`, summary: match[3]?.trim() || line.trim() });
    }
    return result;
  }
}
