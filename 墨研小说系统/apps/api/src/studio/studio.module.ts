import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeepSeekService } from '../generation/deepseek.service';
import { SkillsModule } from '../skills/skills.module';
import { StudioController } from './studio.controller';
import { StudioGenerationService } from './studio-generation.service';
import { StudioService } from './studio.service';

@Module({
  imports: [AuthModule, SkillsModule],
  controllers: [StudioController],
  providers: [StudioService, StudioGenerationService, DeepSeekService],
})
export class StudioModule {}
