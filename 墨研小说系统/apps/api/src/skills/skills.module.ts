import { Global, Module } from '@nestjs/common';
import { SkillService } from './skill.service';

@Global()
@Module({ providers: [SkillService], exports: [SkillService] })
export class SkillsModule {}

