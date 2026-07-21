import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ShortNovelStepKey } from '@moyan/contracts';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface SkillMaterial {
  version: string;
  instructions: string;
  template: string;
  example: string;
}

@Injectable()
export class SkillService {
  private readonly skillRoot: string;
  private readonly cache = new Map<string, SkillMaterial>();

  constructor(@Inject(ConfigService) config: ConfigService) {
    const configured = config.get<string>('SHORT_NOVEL_SKILL_PATH');
    this.skillRoot = configured
      ? path.resolve(configured)
      : path.resolve(
          __dirname,
          '../../../../2026年茗舒短剧爆款速成班/5-短篇小说skill（short-novel-skill）',
        );
  }

  async getShortNovelMaterial(stepKey: ShortNovelStepKey): Promise<SkillMaterial> {
    const phase = this.phase(stepKey);
    const cached = this.cache.get(phase);
    if (cached) return cached;

    const templateNames: Record<string, string> = {
      outline: 'outline-template.md',
      characters: 'character-template.md',
      chapter_index: 'chapter-index-template.md',
      chapter: 'chapter-template.md',
    };
    const exampleNames: Record<string, string | null> = {
      outline: 'outline-example.md',
      characters: 'character-example.md',
      chapter_index: null,
      chapter: 'chapter-example.md',
    };
    const [skill, outlineMethod, outputStyle, template, example] = await Promise.all([
      this.read('SKILL.md'),
      phase === 'chapter' ? Promise.resolve('') : this.read('outline-method.md'),
      this.read('output-style.md'),
      this.read(`templates/${templateNames[phase]}`),
      exampleNames[phase] ? this.read(`examples/${exampleNames[phase]}`) : Promise.resolve(''),
    ]);
    const material: SkillMaterial = {
      version: 'short-novel-skill@2026-07-21',
      instructions: [skill, outlineMethod, outputStyle].filter(Boolean).join('\n\n---\n\n'),
      template,
      example,
    };
    this.cache.set(phase, material);
    return material;
  }

  private phase(stepKey: ShortNovelStepKey) {
    return stepKey.startsWith('chapter_') && stepKey !== 'chapter_index' ? 'chapter' : stepKey;
  }

  private read(relativePath: string) {
    return fs.readFile(path.join(this.skillRoot, relativePath), 'utf8');
  }
}
