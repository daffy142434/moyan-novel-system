import { BadRequestException, Inject, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  SHORT_NOVEL_STEPS,
  type GenerationRunDto,
  type ShortNovelStepKey,
} from '@moyan/contracts';
import { DatabaseService } from '../database/database.service';
import { ProjectsService } from '../projects/projects.service';
import { SkillService } from '../skills/skill.service';
import { DeepSeekService } from './deepseek.service';

const responseSchema = z.object({
  protocol: z.literal('moyan.response.v1'),
  request_id: z.string(),
  status: z.literal('success'),
  result: z.object({
    content: z.string().min(1),
    content_format: z.literal('markdown'),
    structured_data: z.record(z.string(), z.unknown()),
    summary: z.string().default(''),
    warnings: z.array(z.string()).default([]),
    suggested_actions: z.array(z.string()).default([]),
  }),
});

type ParsedResponse = z.infer<typeof responseSchema>;

interface RunRow {
  id: string;
  project_id: string;
  step_key: ShortNovelStepKey;
  status: string;
  candidate_version_id: string | null;
  error_code: string | null;
  error_message: string | null;
  partial_content: string;
  created_at: Date;
  finished_at: Date | null;
}

@Injectable()
export class GenerationService implements OnModuleInit {
  private readonly abortControllers = new Map<string, AbortController>();

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(SkillService) private readonly skills: SkillService,
    @Inject(DeepSeekService) private readonly deepSeek: DeepSeekService,
  ) {}

  async onModuleInit() {
    await this.database.query(
      `update generation_runs
       set status = 'interrupted', error_code = 'PROCESS_RESTARTED',
           error_message = '服务进程重启，任务已中断', finished_at = now()
       where status in ('preparing', 'streaming', 'validating', 'repairing')`,
    );
    await this.database.query(
      `update project_steps set status = 'interrupted', updated_at = now()
       where status = 'generating'`,
    );
  }

  async createRun(
    userId: string,
    projectId: string,
    input: { stepKey?: string; instruction?: string; idempotencyKey?: string },
  ): Promise<GenerationRunDto> {
    if (!input.stepKey || !SHORT_NOVEL_STEPS.includes(input.stepKey as ShortNovelStepKey)) {
      throw new BadRequestException({ code: 'INVALID_STEP_KEY' });
    }
    const stepKey = input.stepKey as ShortNovelStepKey;
    await this.projects.assertStepAvailable(userId, projectId, stepKey);
    const idempotencyKey = input.idempotencyKey?.trim() || randomUUID();
    const inserted = await this.database.query<RunRow>(
      `insert into generation_runs(user_id, project_id, step_key, status, idempotency_key, request_envelope)
       values ($1, $2, $3, 'queued', $4, $5::jsonb)
       on conflict (user_id, idempotency_key) do nothing
       returning id, project_id, step_key, status, candidate_version_id, error_code, error_message,
                 partial_content, created_at, finished_at`,
      [userId, projectId, stepKey, idempotencyKey, JSON.stringify({ instruction: input.instruction ?? '' })],
    );
    if (inserted.rows[0]) {
      await this.database.query(
        `update project_steps set status = 'generating', updated_at = now()
         where project_id = $1 and step_key = $2`,
        [projectId, stepKey],
      );
      setImmediate(() => void this.execute(inserted.rows[0].id, userId, input.instruction ?? ''));
      return this.mapRun(inserted.rows[0]);
    }

    const existing = await this.database.query<RunRow & { project_id: string; step_key: ShortNovelStepKey }>(
      `select id, project_id, step_key, status, candidate_version_id, error_code, error_message,
              partial_content, created_at, finished_at
       from generation_runs where user_id = $1 and idempotency_key = $2`,
      [userId, idempotencyKey],
    );
    if (!existing.rows[0] || existing.rows[0].project_id !== projectId || existing.rows[0].step_key !== stepKey) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REUSED' });
    }
    return this.mapRun(existing.rows[0]);
  }

  async getRun(userId: string, runId: string): Promise<GenerationRunDto> {
    const result = await this.database.query<RunRow>(
      `select id, project_id, step_key, status, candidate_version_id, error_code, error_message,
              partial_content, created_at, finished_at
       from generation_runs where id = $1 and user_id = $2`,
      [runId, userId],
    );
    if (!result.rows[0]) throw new NotFoundException({ code: 'GENERATION_RUN_NOT_FOUND' });
    return this.mapRun(result.rows[0]);
  }

  async cancel(userId: string, runId: string) {
    const result = await this.database.query<{ id: string }>(
      `update generation_runs set cancel_requested = true
       where id = $1 and user_id = $2
         and status in ('queued', 'preparing', 'streaming', 'validating', 'repairing')
       returning id`,
      [runId, userId],
    );
    if (!result.rows[0]) throw new BadRequestException({ code: 'RUN_NOT_CANCELLABLE' });
    this.abortControllers.get(runId)?.abort();
    return { cancelled: true };
  }

  private async execute(runId: string, userId: string, instruction: string) {
    const controller = new AbortController();
    this.abortControllers.set(runId, controller);
    let projectId = '';
    let stepKey: ShortNovelStepKey = 'outline';
    try {
      const run = await this.database.query<{ project_id: string; step_key: ShortNovelStepKey }>(
        `update generation_runs set status = 'preparing', started_at = now()
         where id = $1 and status = 'queued' returning project_id, step_key`,
        [runId],
      );
      if (!run.rows[0]) return;
      projectId = run.rows[0].project_id;
      stepKey = run.rows[0].step_key;
      const [{ project, confirmedArtifacts, promptOverride }, skill] = await Promise.all([
        this.projects.getGenerationContext(userId, projectId, stepKey),
        this.skills.getShortNovelMaterial(stepKey),
      ]);
      const requestId = `req_${runId}`;
      const chapterNumber = stepKey.startsWith('chapter_') && stepKey !== 'chapter_index'
        ? Number(stepKey.split('_')[1])
        : null;
      const systemPrompt = this.buildSystemPrompt(
        requestId,
        stepKey,
        chapterNumber,
        skill,
        promptOverride,
      );
      const userPrompt = JSON.stringify({
        protocol: 'moyan.request.v1',
        request_id: requestId,
        project: {
          id: project.id,
          title: project.title,
          genre: project.genre,
          core_idea: project.coreIdea,
          core_conflict: project.coreConflict,
          tone: project.tone,
          step_key: stepKey,
          chapter_number: chapterNumber,
        },
        confirmed_artifacts: confirmedArtifacts,
        user_instruction: instruction,
      });
      await this.database.query(
        `update generation_runs set status = 'streaming', model = $2, skill_version = $3,
                prompt_snapshot = $4, request_envelope = $5::jsonb
         where id = $1`,
        [runId, this.deepSeek.primaryModel, skill.version, systemPrompt, userPrompt],
      );
      let response = await this.deepSeek.generateJson(systemPrompt, userPrompt, controller.signal);
      await this.database.query(
        `update generation_runs set status = 'validating', partial_content = $2 where id = $1`,
        [runId, response.content],
      );

      let parsed: ParsedResponse;
      try {
        parsed = this.parseAndValidate(response.content, requestId, stepKey, chapterNumber);
      } catch (validationError) {
        await this.database.query(`update generation_runs set status = 'repairing' where id = $1`, [runId]);
        const repairPrompt = `修复下面的模型响应，使其严格满足原系统提示词中的 JSON 协议。只返回修复后的 JSON。\n\n原响应：\n${response.content}\n\n校验错误：${this.errorMessage(validationError)}`;
        response = await this.deepSeek.generateJson(systemPrompt, repairPrompt, controller.signal, this.deepSeek.fastModel);
        parsed = this.parseAndValidate(response.content, requestId, stepKey, chapterNumber);
      }

      await this.database.transaction(async (client) => {
        const artifactResult = await client.query<{ id: string }>(
          `insert into artifacts(project_id, type, logical_key)
           values ($1, $2, $2)
           on conflict (project_id, logical_key) do update set updated_at = now()
           returning id`,
          [projectId, stepKey],
        );
        const versionResult = await client.query<{ next_version: number }>(
          `select coalesce(max(version), 0) + 1 as next_version
           from artifact_versions where artifact_id = $1`,
          [artifactResult.rows[0].id],
        );
        const candidate = await client.query<{ id: string }>(
          `insert into artifact_versions(artifact_id, version, status, content, structured_data, source_run_id, created_by)
           values ($1, $2, 'candidate', $3, $4::jsonb, $5, $6) returning id`,
          [
            artifactResult.rows[0].id,
            Number(versionResult.rows[0].next_version),
            parsed.result.content,
            JSON.stringify(parsed.result.structured_data),
            runId,
            userId,
          ],
        );
        await client.query(
          `update generation_runs
           set status = 'completed', model = $2, normalized_response = $3::jsonb,
               candidate_version_id = $4, input_tokens = $5, output_tokens = $6, finished_at = now()
           where id = $1`,
          [runId, response.model, JSON.stringify(parsed), candidate.rows[0].id, response.inputTokens, response.outputTokens],
        );
        await client.query(
          `update project_steps set status = 'awaiting_confirmation', updated_at = now()
           where project_id = $1 and step_key = $2`,
          [projectId, stepKey],
        );
      });
    } catch (error) {
      const cancelled = controller.signal.aborted;
      const message = this.errorMessage(error);
      const errorCode = cancelled
        ? 'USER_CANCELLED'
        : message.includes('DEEPSEEK_NOT_CONFIGURED')
          ? 'DEEPSEEK_NOT_CONFIGURED'
          : 'GENERATION_FAILED';
      await this.database.query(
        `update generation_runs
         set status = $2, error_code = $3, error_message = $4, finished_at = now()
         where id = $1`,
        [runId, cancelled ? 'cancelled' : 'failed', errorCode, message],
      );
      if (projectId) {
        await this.database.query(
          `update project_steps set status = $3, updated_at = now()
           where project_id = $1 and step_key = $2`,
          [projectId, stepKey, cancelled ? 'available' : 'failed'],
        );
      }
    } finally {
      this.abortControllers.delete(runId);
    }
  }

  private buildSystemPrompt(
    requestId: string,
    stepKey: ShortNovelStepKey,
    chapterNumber: number | null,
    skill: { instructions: string; template: string; example: string },
    promptOverride: string,
  ) {
    const structuredContract = stepKey === 'outline'
      ? '{"title":"书名","genre":"题材","tone":"基调"}'
      : stepKey === 'characters'
        ? '{"characters":[{"name":"姓名","role":"角色定位","summary":"人物摘要"}]}'
        : stepKey === 'chapter_index'
          ? '{"chapters":[{"number":1,"title":"标题","summary":"30-50字简介"}]}，chapters 必须恰好5项且编号1-5'
          : `{"chapterNumber":${chapterNumber},"title":"章节标题"}`;
    return `你是墨研小说系统的短篇小说创作引擎。必须使用中文，并严格遵守下面的 Skill、模板和输出协议。

【当前步骤】${stepKey}

【Skill 方法与规则】
${skill.instructions}

【当前步骤模板】
${skill.template}

【参考示例】
${skill.example || '本步骤无附加示例，严格遵循模板。'}

【用户保存的补充提示词】
${promptOverride || '无'}

【强制响应协议】
只返回一个合法 JSON 对象，不得使用 Markdown 代码围栏，不得在 JSON 前后添加解释：
{
  "protocol": "moyan.response.v1",
  "request_id": "${requestId}",
  "status": "success",
  "result": {
    "content": "严格按模板生成的完整 Markdown 主内容",
    "content_format": "markdown",
    "structured_data": ${structuredContract},
    "summary": "不超过100字的结果摘要",
    "warnings": [],
    "suggested_actions": ["confirm", "regenerate"]
  }
}

模型不得声称已确认步骤、已扣除额度或已解锁下一步。`;
  }

  private parseAndValidate(
    content: string,
    requestId: string,
    stepKey: ShortNovelStepKey,
    chapterNumber: number | null,
  ) {
    const parsed = responseSchema.parse(JSON.parse(content) as unknown);
    if (parsed.request_id !== requestId) throw new Error('Response request_id does not match');
    this.validateBusiness(stepKey, chapterNumber, parsed.result.structured_data);
    return parsed;
  }

  private validateBusiness(stepKey: ShortNovelStepKey, chapterNumber: number | null, data: Record<string, unknown>) {
    if (stepKey === 'chapter_index') {
      const parsed = z.object({
        chapters: z.array(z.object({
          number: z.number().int(),
          title: z.string().min(1),
          summary: z.string().min(1),
        })).length(5),
      }).parse(data);
      if (parsed.chapters.some((chapter, index) => chapter.number !== index + 1)) {
        throw new Error('Chapter index must contain chapter numbers 1 through 5');
      }
    }
    if (stepKey === 'characters') {
      z.object({
        characters: z.array(z.object({
          name: z.string().min(1),
          role: z.string().min(1),
          summary: z.string().min(1),
        })).min(3),
      }).parse(data);
    }
    if (stepKey === 'outline') {
      z.object({
        title: z.string().min(1),
        genre: z.string().min(1),
        tone: z.string().min(1),
      }).parse(data);
    }
    if (chapterNumber !== null) {
      z.object({ chapterNumber: z.literal(chapterNumber), title: z.string().min(1) }).parse(data);
    }
  }

  private errorMessage(error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response?: { code?: string; message?: string } }).response;
      if (response?.code) return `${response.code}: ${response.message ?? ''}`;
    }
    return error instanceof Error ? error.message : 'Unknown generation error';
  }

  private mapRun(row: RunRow): GenerationRunDto {
    return {
      id: row.id,
      projectId: row.project_id,
      stepKey: row.step_key,
      status: row.status,
      candidateVersionId: row.candidate_version_id,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      partialContent: row.partial_content,
      createdAt: row.created_at.toISOString(),
      finishedAt: row.finished_at?.toISOString() ?? null,
    };
  }
}
