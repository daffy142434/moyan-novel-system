import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import {
  SHORT_NOVEL_STEPS,
  type ArtifactVersionDto,
  type ProjectDto,
  type ProjectStepDto,
  type ShortNovelStepKey,
} from '@moyan/contracts';
import { DatabaseService } from '../database/database.service';
import { SkillService } from '../skills/skill.service';

const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(100),
  genre: z.enum(['现代言情', '古代权谋', '悬疑推理', '都市职场', '奇幻玄幻', '科幻未来', '武侠江湖', '历史架空']),
  coreIdea: z.string().trim().min(10).max(2000),
  coreConflict: z.string().trim().min(10).max(2000),
  tone: z.string().trim().min(2).max(100),
});

interface ProjectRow {
  id: string;
  title: string;
  genre: string;
  core_idea: string;
  core_conflict: string;
  tone: string;
  creation_mode: 'short_novel_five_chapter';
  current_step: ShortNovelStepKey;
  created_at: Date;
  updated_at: Date;
}

interface StepRow {
  step_key: ShortNovelStepKey;
  position: number;
  status: ProjectStepDto['status'];
  confirmed_version_id: string | null;
}

interface VersionRow {
  id: string;
  artifact_id: string;
  logical_key: ShortNovelStepKey;
  version: number;
  status: ArtifactVersionDto['status'];
  content: string;
  structured_data: Record<string, unknown>;
  created_at: Date;
}

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(SkillService) private readonly skills: SkillService,
  ) {}

  async create(userId: string, input: unknown): Promise<ProjectDto> {
    const parsed = createProjectSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_PROJECT', issues: parsed.error.issues });
    }
    const projectId = await this.database.transaction(async (client) => {
      const project = await client.query<{ id: string }>(
        `insert into projects(user_id, title, genre, core_idea, core_conflict, tone)
         values ($1, $2, $3, $4, $5, $6) returning id`,
        [userId, parsed.data.title, parsed.data.genre, parsed.data.coreIdea, parsed.data.coreConflict, parsed.data.tone],
      );
      for (const [position, stepKey] of SHORT_NOVEL_STEPS.entries()) {
        await client.query(
          `insert into project_steps(project_id, step_key, position, status)
           values ($1, $2, $3, $4)`,
          [project.rows[0].id, stepKey, position, position === 0 ? 'available' : 'not_started'],
        );
      }
      return project.rows[0].id;
    });
    return this.get(userId, projectId);
  }

  async list(userId: string): Promise<ProjectDto[]> {
    const result = await this.database.query<ProjectRow>(
      `select id, title, genre, core_idea, core_conflict, tone, creation_mode, current_step, created_at, updated_at
       from projects where user_id = $1 and status != 'deleted' order by updated_at desc`,
      [userId],
    );
    return result.rows.map((row) => this.mapProject(row));
  }

  async get(userId: string, projectId: string): Promise<ProjectDto> {
    const projectResult = await this.database.query<ProjectRow>(
      `select id, title, genre, core_idea, core_conflict, tone, creation_mode, current_step, created_at, updated_at
       from projects where id = $1 and user_id = $2 and status != 'deleted'`,
      [projectId, userId],
    );
    const project = projectResult.rows[0];
    if (!project) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND' });
    const [stepsResult, versionsResult] = await Promise.all([
      this.database.query<StepRow>(
        `select step_key, position, status, confirmed_version_id
         from project_steps where project_id = $1 order by position`,
        [projectId],
      ),
      this.database.query<VersionRow>(
        `select av.id, av.artifact_id, a.logical_key, av.version, av.status, av.content, av.structured_data, av.created_at
         from artifact_versions av
         join artifacts a on a.id = av.artifact_id
         where a.project_id = $1 and av.status in ('candidate', 'confirmed')
         order by av.created_at desc`,
        [projectId],
      ),
    ]);
    return {
      ...this.mapProject(project),
      steps: stepsResult.rows.map((row) => ({
        key: row.step_key,
        position: row.position,
        status: row.status,
        confirmedVersionId: row.confirmed_version_id,
      })),
      versions: versionsResult.rows.map((row) => ({
        id: row.id,
        artifactId: row.artifact_id,
        logicalKey: row.logical_key,
        version: row.version,
        status: row.status,
        content: row.content,
        structuredData: row.structured_data,
        createdAt: row.created_at.toISOString(),
      })),
    };
  }

  async assertStepAvailable(userId: string, projectId: string, stepKey: ShortNovelStepKey) {
    if (!SHORT_NOVEL_STEPS.includes(stepKey)) {
      throw new BadRequestException({ code: 'INVALID_STEP_KEY' });
    }
    const result = await this.database.query<{ status: ProjectStepDto['status'] }>(
      `select ps.status from project_steps ps
       join projects p on p.id = ps.project_id
       where ps.project_id = $1 and ps.step_key = $2 and p.user_id = $3 and p.status != 'deleted'`,
      [projectId, stepKey, userId],
    );
    const step = result.rows[0];
    if (!step) throw new NotFoundException({ code: 'PROJECT_STEP_NOT_FOUND' });
    if (!['available', 'editing', 'failed', 'interrupted', 'awaiting_confirmation', 'completed'].includes(step.status)) {
      throw new BadRequestException({ code: 'STEP_DEPENDENCY_NOT_CONFIRMED', status: step.status });
    }
  }

  async getPrompt(userId: string, projectId: string, stepKey: ShortNovelStepKey) {
    await this.assertProjectStep(userId, projectId, stepKey);
    const [material, override] = await Promise.all([
      this.skills.getShortNovelMaterial(stepKey),
      this.database.query<{ content: string; version: number }>(
        `select content, version from prompt_overrides
         where user_id = $1 and project_id = $2 and step_key = $3`,
        [userId, projectId, stepKey],
      ),
    ]);
    return {
      stepKey,
      skillVersion: material.version,
      basePrompt: `${material.instructions}\n\n--- 当前步骤模板 ---\n${material.template}`,
      content: override.rows[0]?.content ?? '',
      version: override.rows[0]?.version ?? 0,
    };
  }

  async updatePrompt(userId: string, projectId: string, stepKey: ShortNovelStepKey, content: string) {
    await this.assertProjectStep(userId, projectId, stepKey);
    if (content.length > 20_000) throw new BadRequestException({ code: 'PROMPT_TOO_LONG' });
    const result = await this.database.query<{ content: string; version: number }>(
      `insert into prompt_overrides(user_id, project_id, step_key, content)
       values ($1, $2, $3, $4)
       on conflict (project_id, step_key) do update
       set content = excluded.content, version = prompt_overrides.version + 1, updated_at = now()
       returning content, version`,
      [userId, projectId, stepKey, content],
    );
    return { stepKey, content: result.rows[0].content, version: result.rows[0].version };
  }

  async getGenerationContext(userId: string, projectId: string, stepKey: ShortNovelStepKey) {
    const project = await this.get(userId, projectId);
    const [context, override] = await Promise.all([
      this.database.query<{ logical_key: string; content: string; structured_data: Record<string, unknown> }>(
        `select a.logical_key, av.content, av.structured_data
         from project_steps ps
         join artifact_versions av on av.id = ps.confirmed_version_id
         join artifacts a on a.id = av.artifact_id
         where ps.project_id = $1 and ps.position < (
           select position from project_steps where project_id = $1 and step_key = $2
         ) order by ps.position`,
        [projectId, stepKey],
      ),
      this.database.query<{ content: string }>(
        `select content from prompt_overrides
         where user_id = $1 and project_id = $2 and step_key = $3`,
        [userId, projectId, stepKey],
      ),
    ]);
    return {
      project,
      confirmedArtifacts: context.rows,
      promptOverride: override.rows[0]?.content ?? '',
    };
  }

  async confirm(userId: string, projectId: string, stepKey: ShortNovelStepKey, versionId: string) {
    await this.database.transaction(async (client) => {
      const candidate = await client.query<{ id: string; artifact_id: string }>(
        `select av.id, av.artifact_id
         from artifact_versions av
         join artifacts a on a.id = av.artifact_id
         join projects p on p.id = a.project_id
         where av.id = $1 and av.status = 'candidate' and a.project_id = $2
           and a.logical_key = $3 and p.user_id = $4
         for update`,
        [versionId, projectId, stepKey, userId],
      );
      if (!candidate.rows[0]) throw new BadRequestException({ code: 'CANDIDATE_VERSION_NOT_FOUND' });
      await client.query(
        `update artifact_versions set status = 'archived'
         where artifact_id = $1 and status = 'confirmed'`,
        [candidate.rows[0].artifact_id],
      );
      await client.query(`update artifact_versions set status = 'confirmed' where id = $1`, [versionId]);
      const stepResult = await client.query<{ position: number }>(
        `update project_steps set status = 'completed', confirmed_version_id = $1, updated_at = now()
         where project_id = $2 and step_key = $3 returning position`,
        [versionId, projectId, stepKey],
      );
      const next = await client.query<{ step_key: ShortNovelStepKey }>(
        `update project_steps set status = 'available', updated_at = now()
         where project_id = $1 and position = $2 and status = 'not_started'
         returning step_key`,
        [projectId, stepResult.rows[0].position + 1],
      );
      await client.query(
        `update projects set current_step = $1, updated_at = now() where id = $2 and user_id = $3`,
        [next.rows[0]?.step_key ?? stepKey, projectId, userId],
      );
    });
    return this.get(userId, projectId);
  }

  private async assertProjectStep(userId: string, projectId: string, stepKey: ShortNovelStepKey) {
    if (!SHORT_NOVEL_STEPS.includes(stepKey)) throw new BadRequestException({ code: 'INVALID_STEP_KEY' });
    const result = await this.database.query(
      `select 1 from project_steps ps join projects p on p.id = ps.project_id
       where ps.project_id = $1 and ps.step_key = $2 and p.user_id = $3 and p.status != 'deleted'`,
      [projectId, stepKey, userId],
    );
    if (!result.rowCount) throw new NotFoundException({ code: 'PROJECT_STEP_NOT_FOUND' });
  }

  private mapProject(row: ProjectRow): ProjectDto {
    return {
      id: row.id,
      title: row.title,
      genre: row.genre,
      coreIdea: row.core_idea,
      coreConflict: row.core_conflict,
      tone: row.tone,
      creationMode: row.creation_mode,
      currentStep: row.current_step,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
