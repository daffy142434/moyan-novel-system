import { Injectable } from '@nestjs/common';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface SkillMaterial {
  version: string;
  instructions: string;
  template: string;
  example: string;
}

export type WorkflowProduct = 'short_drama' | 'comic_drama';
export type WorkflowStage = 'proposal' | 'characters' | 'catalog' | 'episode' | 'review';

@Injectable()
export class SkillService {
  private readonly skillRoot: string;
  private readonly cache = new Map<string, SkillMaterial>();

  constructor() {
    this.skillRoot = path.resolve(__dirname, '../../../../2026年茗舒短剧爆款速成班');
  }

  async getWorkflowMaterial(product: WorkflowProduct, stage: WorkflowStage): Promise<SkillMaterial> {
    const cacheKey = `${product}:${stage}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const courseRoot = this.skillRoot;
    const root = product === 'short_drama'
      ? path.join(courseRoot, '1-写作skill（short-drama）')
      : path.join(courseRoot, '4-漫剧skill（comic-drama）');
    const manifest = product === 'short_drama' ? 'skill.md' : 'SKILL.md';
    const shared: Record<WorkflowStage, string[]> = {
      proposal: ['references/genre-guide.md', 'references/rhythm-design.md', 'references/opening-hooks.md', 'references/conflict-design.md'],
      characters: ['references/character-dev.md'],
      catalog: ['references/rhythm-design.md', 'references/opening-hooks.md', 'references/conflict-design.md'],
      episode: ['references/episode-writing.md', 'references/script-format.md'],
      review: ['references/episode-writing.md', 'references/compliance-checklist.md'],
    };
    const extras = product === 'comic_drama'
      ? stage === 'proposal'
        ? ['references/visual-style.md']
        : stage === 'episode'
          ? ['references/visual-writing.md', 'references/ai-awareness.md']
          : []
      : stage === 'episode'
        ? ['references/overseas-drama-format.md']
        : [];
    const files = [manifest, ...shared[stage], ...extras];
    const sections = await Promise.all(files.map((file) => fs.readFile(path.join(root, file), 'utf8')));
    const material: SkillMaterial = {
      version: `${product}@2026-07-21`,
      instructions: sections.join('\n\n---\n\n'),
      template: '',
      example: '',
    };
    this.cache.set(cacheKey, material);
    return material;
  }
}
