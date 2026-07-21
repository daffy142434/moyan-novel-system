import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { DeepSeekService } from './deepseek.service';

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [GenerationController],
  providers: [GenerationService, DeepSeekService],
})
export class GenerationModule {}

